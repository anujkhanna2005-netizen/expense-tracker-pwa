import localforage from 'localforage';
import { encryptionService } from './encryptionService';

// Explicitly configure localforage to guarantee clean initialization
localforage.config({
  name: 'expense-tracker-pwa-db',
  storeName: 'expense_tracker_store',
  driver: [
    localforage.INDEXEDDB,
    localforage.LOCALSTORAGE
  ]
});

export class StorageQuotaError extends Error {
  constructor(message = 'Storage quota exceeded') {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

function isQuotaError(err: any): boolean {
  if (err instanceof Error) {
    const name = err.name;
    const msg = err.message;
    return (
      name === 'QuotaExceededError' ||
      name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      msg.includes('quota') ||
      msg.includes('Quota') ||
      msg.includes('exceeded')
    );
  }
  return false;
}

export const storageService = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await localforage.getItem<any>(key);
      if (!raw || key === 'settings') {
        return raw as T | null;
      }

      // Check if encryption is enabled
      const settingsState = await localforage.getItem<any>('settings');
      const pinEnabled = settingsState?.state?.settings?.pinEnabled;

      if (pinEnabled && typeof raw === 'string' && raw.includes(':')) {
        try {
          const decrypted = await encryptionService.decrypt(raw);
          return JSON.parse(decrypted) as T;
        } catch (decryptErr) {
          if (import.meta.env.DEV) {
            console.error('Decryption failed for key:', key, decryptErr);
          }
          // If decryption fails (e.g. key missing/mismatched), return null or let it bubble
          return null;
        }
      }

      return raw as T | null;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`storageService.get error for key "${key}":`, error);
      }
      throw error;
    }
  },

  async set<T>(key: string, value: T): Promise<T> {
    try {
      if (key === 'settings') {
        return await localforage.setItem<T>(key, value);
      }

      // Check if encryption is enabled
      const settingsState = await localforage.getItem<any>('settings');
      const pinEnabled = settingsState?.state?.settings?.pinEnabled;

      if (pinEnabled) {
        if (encryptionService.hasSessionKey()) {
          const plaintext = JSON.stringify(value);
          const ciphertext = await encryptionService.encrypt(plaintext);
          await localforage.setItem<string>(key, ciphertext);
          return value;
        } else {
          // APP IS LOCKED: Do NOT overwrite the encrypted database with unencrypted / empty state!
          if (import.meta.env.DEV) {
            console.warn(`storageService.set skipped for "${key}" because app is locked.`);
          }
          return value;
        }
      }

      return await localforage.setItem<T>(key, value);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error(`storageService.set error for key "${key}":`, error);
      }
      if (isQuotaError(error)) {
        throw new StorageQuotaError();
      }
      throw error;
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await localforage.removeItem(key);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`storageService.remove error for key "${key}":`, error);
      }
      throw error;
    }
  },

  async clear(): Promise<void> {
    try {
      await localforage.clear();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('storageService.clear error:', error);
      }
      throw error;
    }
  }
};

export default storageService;

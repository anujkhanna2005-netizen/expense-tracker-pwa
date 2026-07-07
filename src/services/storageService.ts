import localforage from 'localforage';

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
      return await localforage.getItem<T>(key);
    } catch (error) {
      console.error(`storageService.get error for key "${key}":`, error);
      throw error;
    }
  },

  async set<T>(key: string, value: T): Promise<T> {
    try {
      return await localforage.setItem<T>(key, value);
    } catch (error: any) {
      console.error(`storageService.set error for key "${key}":`, error);
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
      console.error(`storageService.remove error for key "${key}":`, error);
      throw error;
    }
  },

  async clear(): Promise<void> {
    try {
      await localforage.clear();
    } catch (error) {
      console.error('storageService.clear error:', error);
      throw error;
    }
  }
};
export default storageService;

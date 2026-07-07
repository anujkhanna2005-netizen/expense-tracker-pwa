import type { PersistStorage } from 'zustand/middleware';
import { storageService } from '../services/storageService';
import { useUiStore } from './uiStore';

export const customPersistStorage: PersistStorage<any> = {
  getItem: async (name) => {
    try {
      const value = await storageService.get<any>(name);
      return value || null;
    } catch (err: any) {
      console.error(`Failed to load store "${name}":`, err);
      // Wait: useUiStore might not be initialized yet during early boot, so wrap in safe call
      try {
        useUiStore.getState().addToast(`Failed to load store "${name}": ${err.message || err}`, 'error');
      } catch (uiErr) {}
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await storageService.set(name, value);
    } catch (err: any) {
      console.error(`Failed to save store "${name}":`, err);
      try {
        useUiStore.getState().addToast(`Failed to save data: ${err.message || err}`, 'error');
      } catch (uiErr) {}
    }
  },
  removeItem: async (name) => {
    try {
      await storageService.remove(name);
    } catch (err: any) {
      console.error(`Failed to remove store "${name}":`, err);
    }
  }
};
export default customPersistStorage;

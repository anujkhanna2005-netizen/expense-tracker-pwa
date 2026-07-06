import type { PersistStorage } from 'zustand/middleware';
import { storageService } from '../services/storageService';

export const customPersistStorage: PersistStorage<any> = {
  getItem: async (name) => {
    const value = await storageService.get<any>(name);
    return value || null;
  },
  setItem: async (name, value) => {
    await storageService.set(name, value);
  },
  removeItem: async (name) => {
    await storageService.remove(name);
  }
};
export default customPersistStorage;

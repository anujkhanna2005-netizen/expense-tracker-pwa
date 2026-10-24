import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customPersistStorage } from './customStorage';
import { settingsSchema } from '../utils/validation';
import { useUiStore } from './uiStore';
import type { Settings } from '../types';

interface SettingsState {
  settings: Settings;
  isFirstLaunch: boolean;
  updateSettings: (updates: Partial<Settings>) => boolean;
  updateCategoryBudget: (categoryId: string, limit: number) => boolean;
  setMerchantCategory: (merchant: string, categoryId: string) => boolean;
  setIsFirstLaunch: (val: boolean) => void;
  resetSettings: () => void;
}

const defaultSettings: Settings = {
  darkMode: false,
  currency: 'INR',
  categoryBudgets: {},
  merchantCategoryMap: {},
  autoImportHighConfidence: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      isFirstLaunch: true,

      updateSettings: (updates) => {
        const nextSettings = { ...get().settings, ...updates };
        const validation = settingsSchema.safeParse(nextSettings);
        if (!validation.success) {
          const errMsg = validation.error.issues[0]?.message || 'Invalid settings';
          useUiStore.getState().addToast(errMsg, 'error');
          return false;
        }

        set({ settings: nextSettings });
        return true;
      },

      updateCategoryBudget: (categoryId, limit) => {
        const settings = get().settings;
        const categoryBudgets = { ...(settings.categoryBudgets || {}) };
        
        if (limit <= 0) {
          delete categoryBudgets[categoryId];
        } else {
          categoryBudgets[categoryId] = limit;
        }

        return get().updateSettings({ categoryBudgets });
      },

      setMerchantCategory: (merchant, categoryId) => {
        const key = merchant.trim().toLowerCase();
        if (!key) return false;
        const current = get().settings.merchantCategoryMap || {};
        const updated = { ...current, [key]: categoryId };
        return get().updateSettings({ merchantCategoryMap: updated });
      },

      setIsFirstLaunch: (val) => set({ isFirstLaunch: val }),

      resetSettings: () => set({ settings: defaultSettings, isFirstLaunch: true }),
    }),
    {
       name: 'settings',
       storage: customPersistStorage,
       version: 1,
       partialize: (state) => ({ settings: state.settings, isFirstLaunch: state.isFirstLaunch }),
       migrate: (persistedState: any, _version: number) => {
         if (persistedState && persistedState.settings) {
           const currency = persistedState.settings.currency;
           const symbolToCodeMap: Record<string, string> = {
             '$': 'USD',
             '€': 'EUR',
             '£': 'GBP',
             '₹': 'INR',
             '¥': 'JPY',
             'CA$': 'CAD',
             'A$': 'AUD'
           };
           if (currency && symbolToCodeMap[currency]) {
             persistedState.settings.currency = symbolToCodeMap[currency];
           }
         }
         return persistedState;
       }
     }
  )
);

// Apply dark mode side effect
useSettingsStore.subscribe((state) => {
  if (typeof document !== 'undefined' && document.documentElement) {
    if (state.settings.darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }
});

export default useSettingsStore;

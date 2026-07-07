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
  setIsFirstLaunch: (val: boolean) => void;
  resetSettings: () => void;
}

const defaultSettings: Settings = {
  darkMode: false,
  currency: '₹',
  categoryBudgets: {},
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

      setIsFirstLaunch: (val) => set({ isFirstLaunch: val }),

      resetSettings: () => set({ settings: defaultSettings, isFirstLaunch: true }),
    }),
    {
      name: 'settings',
      storage: customPersistStorage,
    }
  )
);

// Apply dark mode side effect
useSettingsStore.subscribe((state) => {
  if (state.settings.darkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
});

export default useSettingsStore;

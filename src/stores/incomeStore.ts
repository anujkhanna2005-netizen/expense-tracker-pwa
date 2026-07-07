import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customPersistStorage } from './customStorage';
import { incomeSchema } from '../utils/validation';
import { useUiStore } from './uiStore';
import type { Income } from '../types/income';

import { createBaseActions } from './createEntityStore';

interface IncomeState {
  incomes: Income[];
  addIncome: (data: Omit<Income, 'id' | 'createdAt' | 'updatedAt'> | Income) => boolean;
  updateIncome: (id: string, updates: Partial<Income>) => boolean;
  deleteIncome: (id: string) => void;
  setIncomes: (incomes: Income[]) => void;
  resetIncomes: () => void;
  getByMonth: (monthYear: string) => Income[]; // monthYear = 'YYYY-MM'
}

const actions = createBaseActions<Income>(incomeSchema, 'Invalid income data');

export const useIncomeStore = create<IncomeState>()(
  persist(
    (set, get) => ({
      incomes: [],

      addIncome: (data) => {
        if ('id' in data) {
          const validation = incomeSchema.safeParse(data);
          if (!validation.success) {
            const errMsg = validation.error.issues[0]?.message || 'Invalid income data';
            useUiStore.getState().addToast(errMsg, 'error');
            return false;
          }
          set((state) => ({ incomes: [data as Income, ...state.incomes] }));
          return true;
        }

        const { success, nextItems } = actions.add(get().incomes, data);
        if (success && nextItems) {
          set({ incomes: nextItems });
          return true;
        }
        return false;
      },

      updateIncome: (id, updates) => {
        const { success, nextItems } = actions.update(get().incomes, id, updates);
        if (success && nextItems) {
          set({ incomes: nextItems });
          return true;
        }
        return false;
      },

      deleteIncome: (id) => {
        set({ incomes: actions.delete(get().incomes, id) });
      },

      setIncomes: (incomes) => set({ incomes }),

      resetIncomes: () => set({ incomes: [] }),

      getByMonth: (monthYear) => {
        return get().incomes.filter((i) => i.date.startsWith(monthYear));
      },
    }),
    {
      name: 'incomes',
      storage: customPersistStorage,
    }
  )
);

export default useIncomeStore;

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customPersistStorage } from './customStorage';
import { incomeSchema } from '../utils/validation';
import { useUiStore } from './uiStore';
import type { Income } from '../types/income';

interface IncomeState {
  incomes: Income[];
  addIncome: (data: Omit<Income, 'id' | 'createdAt' | 'updatedAt'> | Income) => boolean;
  updateIncome: (id: string, updates: Partial<Income>) => boolean;
  deleteIncome: (id: string) => void;
  setIncomes: (incomes: Income[]) => void;
  resetIncomes: () => void;
  getByMonth: (monthYear: string) => Income[]; // monthYear = 'YYYY-MM'
}

export const useIncomeStore = create<IncomeState>()(
  persist(
    (set, get) => ({
      incomes: [],

      addIncome: (data) => {
        let newIncome: Income;
        if ('id' in data) {
          newIncome = data as Income;
        } else {
          newIncome = {
            ...data,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }

        const validation = incomeSchema.safeParse(newIncome);
        if (!validation.success) {
          const errMsg = validation.error.issues[0]?.message || 'Invalid income data';
          useUiStore.getState().addToast(errMsg, 'error');
          return false;
        }

        set((state) => ({ incomes: [newIncome, ...state.incomes] }));
        return true;
      },

      updateIncome: (id, updates) => {
        const incomes = get().incomes;
        const index = incomes.findIndex((i) => i.id === id);
        if (index === -1) return false;

        const nextIncome: Income = {
          ...incomes[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        const validation = incomeSchema.safeParse(nextIncome);
        if (!validation.success) {
          const errMsg = validation.error.issues[0]?.message || 'Invalid income data';
          useUiStore.getState().addToast(errMsg, 'error');
          return false;
        }

        set((state) => ({
          incomes: state.incomes.map((i) => (i.id === id ? nextIncome : i)),
        }));
        return true;
      },

      deleteIncome: (id) => {
        set((state) => ({ incomes: state.incomes.filter((i) => i.id !== id) }));
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

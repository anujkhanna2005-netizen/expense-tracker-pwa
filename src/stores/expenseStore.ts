import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customPersistStorage } from './customStorage';
import { expenseSchema } from '../utils/validation';
import { useUiStore } from './uiStore';
import { useSettingsStore } from './settingsStore';
import { useCategoryStore } from './categoryStore';
import type { Expense } from '../types';

interface ExpenseState {
  expenses: Expense[];
  addExpense: (expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> | Expense) => boolean;
  updateExpense: (id: string, updates: Partial<Expense>) => boolean;
  deleteExpense: (id: string) => void;
  setExpenses: (expenses: Expense[]) => void;
  resetExpenses: () => void;
}

export const useExpenseStore = create<ExpenseState>()(
  persist(
    (set, get) => ({
      expenses: [],

      addExpense: (expenseData) => {
        // Check if a matching expense exists for the same date, category, method, and notes to merge
        if (!('id' in expenseData)) {
          const matchingIndex = get().expenses.findIndex((e) => {
            const notesA = (e.notes || '').trim().toLowerCase();
            const notesB = (expenseData.notes || '').trim().toLowerCase();
            return (
              e.date === expenseData.date &&
              e.categoryId === expenseData.categoryId &&
              e.paymentMethod === expenseData.paymentMethod &&
              notesA === notesB
            );
          });

          if (matchingIndex !== -1) {
            const existing = get().expenses[matchingIndex];
            const updatedAmount = existing.amount + Number(expenseData.amount);
            return get().updateExpense(existing.id, { amount: updatedAmount });
          }
        }

        let newExpense: Expense;
        if ('id' in expenseData) {
          newExpense = expenseData as Expense;
        } else {
          newExpense = {
            ...expenseData,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }

        const validation = expenseSchema.safeParse(newExpense);
        if (!validation.success) {
          const errMsg = validation.error.issues[0]?.message || 'Invalid expense data';
          useUiStore.getState().addToast(errMsg, 'error');
          return false;
        }

        set((state) => ({ expenses: [newExpense, ...state.expenses] }));

        // Budget check warning logic
        const currentMonth = newExpense.date.slice(0, 7);
        const categoryId = newExpense.categoryId;
        const limit = useSettingsStore.getState().settings.categoryBudgets?.[categoryId] || 0;
        
        if (limit > 0) {
          const categoryExpenses = get().expenses.filter(
            (e) => e.categoryId === categoryId && e.date.startsWith(currentMonth)
          );
          const totalCategorySpent = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
          
          if (totalCategorySpent > limit) {
            const cat = useCategoryStore.getState().categories.find((c) => c.id === categoryId);
            const catName = cat?.name || 'Category';
            useUiStore.getState().addToast(
              `⚠️ Budget limit exceeded for ${catName}! Spent ${totalCategorySpent} / Limit ${limit}`,
              'error'
            );
          }
        }

        if (useSettingsStore.getState().isFirstLaunch) {
          useSettingsStore.getState().setIsFirstLaunch(false);
        }
        return true;
      },

      updateExpense: (id, updates) => {
        const expenses = get().expenses;
        const index = expenses.findIndex((e) => e.id === id);
        if (index === -1) return false;

        const nextExpense = {
          ...expenses[index],
          ...updates,
          updatedAt: new Date().toISOString()
        };

        const validation = expenseSchema.safeParse(nextExpense);
        if (!validation.success) {
          const errMsg = validation.error.issues[0]?.message || 'Invalid expense data';
          useUiStore.getState().addToast(errMsg, 'error');
          return false;
        }

        set((state) => ({
          expenses: state.expenses.map((e) => (e.id === id ? nextExpense : e))
        }));
        return true;
      },

      deleteExpense: (id) => {
        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== id)
        }));
      },

      setExpenses: (expenses) => set({ expenses }),

      resetExpenses: () => set({ expenses: [] }),
    }),
    {
      name: 'expenses',
      storage: customPersistStorage,
    }
  )
);

export default useExpenseStore;

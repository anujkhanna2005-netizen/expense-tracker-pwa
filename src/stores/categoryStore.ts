import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customPersistStorage } from './customStorage';
import { categorySchema } from '../utils/validation';
import { useUiStore } from './uiStore';
import type { Category } from '../types';

interface CategoryState {
  categories: Category[];
  addCategory: (categoryData: Omit<Category, 'id'>) => boolean;
  updateCategory: (id: string, updates: Partial<Category>) => boolean;
  deleteCategory: (id: string, expensesInUse: boolean, billsInUse: boolean) => boolean;
  setCategories: (categories: Category[]) => void;
  resetCategories: () => void;
}

const defaultCategories: Category[] = [
  { id: 'cat_rent', name: 'Rent', isDefault: true, icon: '🏠' },
  { id: 'cat_elec', name: 'Electricity', isDefault: true, icon: '⚡' },
  { id: 'cat_water', name: 'Water', isDefault: true, icon: '💧' },
  { id: 'cat_internet', name: 'Internet', isDefault: true, icon: '🌐' },
  { id: 'cat_groceries', name: 'Groceries', isDefault: true, icon: '🛒' },
  { id: 'cat_fuel', name: 'Fuel', isDefault: true, icon: '⛽' },
  { id: 'cat_food', name: 'Food & Dining', isDefault: true, icon: '🍔' },
  { id: 'cat_college', name: 'College Expenses', isDefault: true, icon: '🎓' },
  { id: 'cat_books', name: 'Books & Stationery', isDefault: true, icon: '📚' },
  { id: 'cat_medical', name: 'Medical', isDefault: true, icon: '💊' },
  { id: 'cat_travel', name: 'Travel', isDefault: true, icon: '✈️' },
  { id: 'cat_shopping', name: 'Shopping', isDefault: true, icon: '🛍️' },
  { id: 'cat_entertainment', name: 'Entertainment', isDefault: true, icon: '🎬' },
  { id: 'cat_misc', name: 'Miscellaneous', isDefault: true, icon: '📦' },
];

export const useCategoryStore = create<CategoryState>()(
  persist(
    (set, get) => ({
      categories: defaultCategories,

      addCategory: (categoryData) => {
        const newCategory: Category = {
          ...categoryData,
          id: `cat_${crypto.randomUUID()}`
        };
        const validation = categorySchema.safeParse(newCategory);
        if (!validation.success) {
          const errMsg = validation.error.issues[0]?.message || 'Invalid category';
          useUiStore.getState().addToast(errMsg, 'error');
          return false;
        }

        set((state) => ({ categories: [...state.categories, newCategory] }));
        return true;
      },

      updateCategory: (id, updates) => {
        const categories = get().categories;
        const index = categories.findIndex((c) => c.id === id);
        if (index === -1) return false;

        const nextCategory = { ...categories[index], ...updates };
        const validation = categorySchema.safeParse(nextCategory);
        if (!validation.success) {
          const errMsg = validation.error.issues[0]?.message || 'Invalid category data';
          useUiStore.getState().addToast(errMsg, 'error');
          return false;
        }

        set((state) => ({
          categories: state.categories.map((c) => (c.id === id ? nextCategory : c))
        }));
        return true;
      },

      deleteCategory: (id, expensesInUse, billsInUse) => {
        if (expensesInUse || billsInUse) {
          useUiStore.getState().addToast(
            'Cannot delete category because it is currently used by an expense or bill.',
            'error'
          );
          return false;
        }
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id)
        }));
        return true;
      },

      setCategories: (categories) => set({ categories }),

      resetCategories: () => set({ categories: defaultCategories }),
    }),
    {
      name: 'categories',
      storage: customPersistStorage,
      partialize: (state) => ({ categories: state.categories }),
    }
  )
);

export default useCategoryStore;

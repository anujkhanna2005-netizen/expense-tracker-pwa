import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import localforage from 'localforage';
import type { Expense, Category, Bill, Goal, Split, Settings } from '../types';

interface DataContextType {
  expenses: Expense[];
  categories: Category[];
  bills: Bill[];
  goals: Goal[];
  splits: Split[];
  settings: Settings;
  
  // Actions
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateExpense: (id: string, expense: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, category: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  addBill: (bill: Omit<Bill, 'id'>) => void;
  updateBill: (id: string, updates: Partial<Bill>) => void;
  deleteBill: (id: string) => void;
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;

  updateSettings: (settings: Partial<Settings>) => void;
  resetData: () => void;
  
  isLoading: boolean;
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

const defaultSettings: Settings = {
  darkMode: false,
  currency: '₹',
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [splits, setSplits] = useState<Split[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize data
  useEffect(() => {
    const loadData = async () => {
      try {
        const hasSeededV2 = await localforage.getItem<boolean>('demo_v2_loaded');
        
        if (!hasSeededV2) {
          await localforage.clear();
          
          const defaultGoalsData: Goal[] = [
            { id: 'goal_laptop', name: 'New Laptop', targetAmount: 120000, currentAmount: 45000, createdAt: new Date().toISOString() },
            { id: 'goal_vacation', name: 'Goa Trip', targetAmount: 40000, currentAmount: 15000, createdAt: new Date().toISOString() },
            { id: 'goal_emergency', name: 'Emergency Fund', targetAmount: 500000, currentAmount: 100000, createdAt: new Date().toISOString() }
          ];

          const today = new Date().toISOString().split('T')[0];
          const defaultExpensesData: Expense[] = [
            { id: 'exp_1', amount: 25000, categoryId: 'cat_rent', date: today, notes: 'Rent', paymentMethod: 'Bank Transfer', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: 'exp_2', amount: 4500, categoryId: 'cat_groceries', date: today, notes: 'Groceries', paymentMethod: 'UPI', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: 'exp_3', amount: 2000, categoryId: 'cat_fuel', date: today, notes: 'Petrol', paymentMethod: 'Debit Card', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: 'exp_4', amount: 350, categoryId: 'cat_food', date: today, notes: 'Coffee', paymentMethod: 'UPI', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: 'exp_5', amount: 500, categoryId: 'cat_misc', date: today, notes: 'Laundry', paymentMethod: 'Cash', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          ];

          const defaultBillsData: Bill[] = [
            { id: 'bill_1', name: 'Electricity', amount: 1500, categoryId: 'cat_elec', dueDate: today, isPaid: false, reminderEnabled: true },
            { id: 'bill_2', name: 'WiFi', amount: 999, categoryId: 'cat_internet', dueDate: today, isPaid: true, reminderEnabled: false },
            { id: 'bill_3', name: 'Netflix', amount: 649, categoryId: 'cat_entertainment', dueDate: today, isPaid: false, reminderEnabled: false },
            { id: 'bill_4', name: 'Mobile Recharge', amount: 499, categoryId: 'cat_misc', dueDate: today, isPaid: false, reminderEnabled: false }
          ];

          await localforage.setItem('goals', defaultGoalsData);
          await localforage.setItem('expenses', defaultExpensesData);
          await localforage.setItem('bills', defaultBillsData);
          await localforage.setItem('categories', defaultCategories);
          await localforage.setItem('settings', { ...defaultSettings, currency: '₹' });
          await localforage.setItem('demo_v2_loaded', true);
        }

        const loadedExpenses = await localforage.getItem<Expense[]>('expenses') || [];
        let loadedCategories = await localforage.getItem<Category[]>('categories');
        const loadedBills = await localforage.getItem<Bill[]>('bills') || [];
        const loadedGoals = await localforage.getItem<Goal[]>('goals') || [];
        const loadedSplits = await localforage.getItem<Split[]>('splits') || [];
        const loadedSettings = await localforage.getItem<Settings>('settings') || defaultSettings;

        if (!loadedCategories || loadedCategories.length === 0) {
          loadedCategories = defaultCategories;
          await localforage.setItem('categories', defaultCategories);
        }

        // Auto-migrate USD to ₹ for existing users
        if (loadedSettings.currency === 'USD') {
          loadedSettings.currency = '₹';
          await localforage.setItem('settings', loadedSettings);
        }

        setExpenses(loadedExpenses);
        setCategories(loadedCategories);
        setBills(loadedBills);
        setGoals(loadedGoals);
        setSplits(loadedSplits);
        setSettings(loadedSettings);
        
        // Apply dark mode immediately
        if (loadedSettings.darkMode) {
          document.documentElement.setAttribute('data-theme', 'dark');
        }

      } catch (error) {
        console.error("Error loading data", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Sync to localforage when state changes
  useEffect(() => {
    if (!isLoading) {
      localforage.setItem('expenses', expenses);
    }
  }, [expenses, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localforage.setItem('categories', categories);
    }
  }, [categories, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localforage.setItem('bills', bills);
    }
  }, [bills, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localforage.setItem('goals', goals);
    }
  }, [goals, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localforage.setItem('settings', settings);
      if (settings.darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }
  }, [settings, isLoading]);

  const addExpense = (expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newExpense: Expense = {
      ...expenseData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setExpenses(prev => [newExpense, ...prev]);
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setExpenses(prev => prev.map(exp => 
      exp.id === id ? { ...exp, ...updates, updatedAt: new Date().toISOString() } : exp
    ));
  };

  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(exp => exp.id !== id));
  };

  const addCategory = (categoryData: Omit<Category, 'id'>) => {
    const newCategory: Category = {
      ...categoryData,
      id: `cat_${crypto.randomUUID()}`,
    };
    setCategories(prev => [...prev, newCategory]);
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(cat => cat.id === id ? { ...cat, ...updates } : cat));
  };

  const deleteCategory = (id: string) => {
    setCategories(prev => prev.filter(cat => cat.id !== id));
  };

  const addBill = (billData: Omit<Bill, 'id'>) => {
    const newBill: Bill = {
      ...billData,
      id: crypto.randomUUID(),
    };
    setBills(prev => [...prev, newBill]);
  };

  const updateBill = (id: string, updates: Partial<Bill>) => {
    setBills(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const deleteBill = (id: string) => {
    setBills(prev => prev.filter(b => b.id !== id));
  };

  const addGoal = (goalData: Omit<Goal, 'id' | 'createdAt'>) => {
    const newGoal: Goal = {
      ...goalData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    setGoals(prev => [...prev, newGoal]);
  };

  const updateGoal = (id: string, updates: Partial<Goal>) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  };

  const deleteGoal = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const updateSettings = (updates: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const resetData = async () => {
    await localforage.clear();
    setExpenses([]);
    setCategories(defaultCategories);
    setBills([]);
    setGoals([]);
    setSplits([]);
    setSettings(defaultSettings);
    await localforage.setItem('categories', defaultCategories);
  };

  return (
    <DataContext.Provider value={{
      expenses, categories, bills, goals, splits, settings,
      addExpense, updateExpense, deleteExpense,
      addCategory, updateCategory, deleteCategory,
      addBill, updateBill, deleteBill, addGoal, updateGoal, deleteGoal,
      updateSettings, resetData, isLoading
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

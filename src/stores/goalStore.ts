import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customPersistStorage } from './customStorage';
import { goalSchema } from '../utils/validation';
import { useUiStore } from './uiStore';
import type { Goal } from '../types';

interface GoalState {
  goals: Goal[];
  addGoal: (goalData: Omit<Goal, 'id' | 'createdAt'>) => boolean;
  updateGoal: (id: string, updates: Partial<Goal>) => boolean;
  deleteGoal: (id: string) => void;
  setGoals: (goals: Goal[]) => void;
  resetGoals: () => void;
}

export const useGoalStore = create<GoalState>()(
  persist(
    (set, get) => ({
      goals: [],

      addGoal: (goalData) => {
        const newGoal: Goal = {
          ...goalData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString()
        };
        const validation = goalSchema.safeParse(newGoal);
        if (!validation.success) {
          const errMsg = validation.error.issues[0]?.message || 'Invalid goal data';
          useUiStore.getState().addToast(errMsg, 'error');
          return false;
        }

        set((state) => ({ goals: [...state.goals, newGoal] }));
        return true;
      },

      updateGoal: (id, updates) => {
        const goals = get().goals;
        const index = goals.findIndex((g) => g.id === id);
        if (index === -1) return false;

        const nextGoal = {
          ...goals[index],
          ...updates
        };

        const validation = goalSchema.safeParse(nextGoal);
        if (!validation.success) {
          const errMsg = validation.error.issues[0]?.message || 'Invalid goal data';
          useUiStore.getState().addToast(errMsg, 'error');
          return false;
        }

        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? nextGoal : g))
        }));
        return true;
      },

      deleteGoal: (id) => {
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id)
        }));
      },

      setGoals: (goals) => set({ goals }),

      resetGoals: () => set({ goals: [] }),
    }),
    {
      name: 'goals',
      storage: customPersistStorage,
    }
  )
);

export default useGoalStore;

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customPersistStorage } from './customStorage';
import { goalSchema } from '../utils/validation';
import type { Goal } from '../types';

import { createBaseActions } from './createEntityStore';

interface GoalState {
  goals: Goal[];
  addGoal: (goalData: Omit<Goal, 'id' | 'createdAt'>) => boolean;
  updateGoal: (id: string, updates: Partial<Goal>) => boolean;
  deleteGoal: (id: string) => void;
  setGoals: (goals: Goal[]) => void;
  resetGoals: () => void;
}

const actions = createBaseActions<Goal>(goalSchema, 'Invalid goal data');

export const useGoalStore = create<GoalState>()(
  persist(
    (set, get) => ({
      goals: [],

      addGoal: (goalData) => {
        const { success, nextItems } = actions.add(get().goals, goalData);
        if (success && nextItems) {
          set({ goals: nextItems });
          return true;
        }
        return false;
      },

      updateGoal: (id, updates) => {
        const { success, nextItems } = actions.update(get().goals, id, updates);
        if (success && nextItems) {
          set({ goals: nextItems });
          return true;
        }
        return false;
      },

      deleteGoal: (id) => {
        set({ goals: actions.delete(get().goals, id) });
      },

      setGoals: (goals) => set({ goals }),

      resetGoals: () => set({ goals: [] }),
    }),
    {
      name: 'goals',
      storage: customPersistStorage,
      partialize: (state) => ({ goals: state.goals }),
    }
  )
);

export default useGoalStore;

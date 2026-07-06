import { useGoalStore } from '../stores/goalStore';
import { useMemo } from 'react';

export function useGoals() {
  const goals = useGoalStore((state) => state.goals);
  const addGoal = useGoalStore((state) => state.addGoal);
  const updateGoal = useGoalStore((state) => state.updateGoal);
  const deleteGoal = useGoalStore((state) => state.deleteGoal);

  const totalSaved = useMemo(() => {
    return goals.reduce((sum, g) => sum + g.currentAmount, 0);
  }, [goals]);

  const totalTarget = useMemo(() => {
    return goals.reduce((sum, g) => sum + g.targetAmount, 0);
  }, [goals]);

  return {
    goals,
    totalSaved,
    totalTarget,
    addGoal,
    updateGoal,
    deleteGoal
  };
}
export default useGoals;

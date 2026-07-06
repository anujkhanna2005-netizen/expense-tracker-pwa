import type { Expense } from '../types';

export const calculateTotalExpenses = (expenses: Expense[]): number => {
  return expenses.reduce((sum, exp) => sum + exp.amount, 0);
};

export const calculateBudgetProgress = (totalSpent: number, budgetLimit: number): number => {
  if (budgetLimit <= 0) return 0;
  return Math.min((totalSpent / budgetLimit) * 100, 100);
};

export const calculateGoalProgress = (currentAmount: number, targetAmount: number): number => {
  if (targetAmount <= 0) return 0;
  return Math.min((currentAmount / targetAmount) * 100, 100);
};

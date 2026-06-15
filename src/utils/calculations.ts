import type { Expense, SplitParticipant } from '../types';

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

export const calculateSettlements = (participants: SplitParticipant[], paidById: string, totalAmount: number): Record<string, number> => {
  // Very lightweight split logic (equal split)
  const numParticipants = participants.length;
  if (numParticipants === 0) return {};
  
  const share = totalAmount / numParticipants;
  const settlements: Record<string, number> = {};
  
  participants.forEach(p => {
    if (p.id !== paidById && !p.isSettled) {
      settlements[p.id] = share; // Positive means they owe the payer
    }
  });
  
  return settlements;
};

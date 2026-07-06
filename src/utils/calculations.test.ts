import { describe, it, expect } from 'vitest';
import { 
  calculateTotalExpenses, 
  calculateBudgetProgress, 
  calculateGoalProgress
} from './calculations';
import type { Expense } from '../types';

describe('Financial Calculations', () => {
  
  it('calculates total expenses correctly', () => {
    const expenses: Partial<Expense>[] = [
      { amount: 100 },
      { amount: 50.5 },
      { amount: 200 }
    ];
    expect(calculateTotalExpenses(expenses as Expense[])).toBe(350.5);
  });

  it('calculates budget progress percentage', () => {
    expect(calculateBudgetProgress(50, 100)).toBe(50);
    expect(calculateBudgetProgress(150, 100)).toBe(100); // capped at 100%
    expect(calculateBudgetProgress(0, 100)).toBe(0);
    expect(calculateBudgetProgress(50, 0)).toBe(0); // edge case
  });

  it('calculates goal progress percentage', () => {
    expect(calculateGoalProgress(200, 1000)).toBe(20);
    expect(calculateGoalProgress(1000, 1000)).toBe(100);
    expect(calculateGoalProgress(1200, 1000)).toBe(100); // capped at 100%
  });
});

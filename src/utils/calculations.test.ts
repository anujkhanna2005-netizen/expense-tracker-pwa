import { describe, it, expect } from 'vitest';
import { 
  calculateTotalExpenses, 
  calculateTotalIncome,
  calculateNetCashFlow,
  calculateCategoryTotals,
  calculateBudgetProgress, 
  calculateGoalProgress
} from './calculations';
import type { Expense, Category } from '../types';
import type { Income } from '../types/income';

const mockCategories: Category[] = [
  { id: 'cat-food', name: 'Food & Dining', icon: '🍔', isDefault: true },
  { id: 'cat-shopping', name: 'Shopping', icon: '🛍️', isDefault: true },
  { id: 'cat-transfer', name: 'Transfer', icon: '↔️', isDefault: true },
  { id: 'cat-travel', name: 'Travel', icon: '✈️', isDefault: true },
];

describe('Financial Calculations — Accuracy & Safety Suite', () => {
  describe('calculateTotalExpenses', () => {
    it('calculates regular expenses correctly', () => {
      const expenses: Partial<Expense>[] = [
        { amount: 100 },
        { amount: 50.5 },
        { amount: 200 }
      ];
      expect(calculateTotalExpenses(expenses as Expense[])).toBe(350.5);
    });

    it('excludes reversed payments (e.g. failed payment reversals)', () => {
      const expenses: Partial<Expense>[] = [
        { amount: 500, isReversed: true, notes: 'Failed order reversed' },
        { amount: 150, isReversed: false },
      ];
      expect(calculateTotalExpenses(expenses as Expense[])).toBe(150);
    });

    it('excludes internal transfers between own accounts from spending totals', () => {
      const expenses: Partial<Expense>[] = [
        { amount: 10000, isTransfer: true, notes: 'Transfer to HDFC savings' },
        { amount: 300, isTransfer: false },
      ];
      expect(calculateTotalExpenses(expenses as Expense[])).toBe(300);
    });

    it('deducts refunded amounts linked to the expense', () => {
      const expenses: Partial<Expense>[] = [
        { amount: 1000, refundedAmount: 300 }, // net 700
        { amount: 500, refundedAmount: 500 },  // fully refunded = net 0
        { amount: 200 },                       // no refund = net 200
      ];
      expect(calculateTotalExpenses(expenses as Expense[])).toBe(900);
    });

    it('clamps net expense to 0 if refundedAmount exceeds expense amount', () => {
      const expenses: Partial<Expense>[] = [
        { amount: 200, refundedAmount: 250 },
      ];
      expect(calculateTotalExpenses(expenses as Expense[])).toBe(0);
    });
  });

  describe('calculateTotalIncome', () => {
    it('calculates regular income correctly', () => {
      const incomes: Partial<Income>[] = [
        { amount: 50000, source: 'Salary' },
        { amount: 5000, source: 'Freelance' },
      ];
      expect(calculateTotalIncome(incomes as Income[])).toBe(55000);
    });

    it('excludes internal transfers from income totals', () => {
      const incomes: Partial<Income>[] = [
        { amount: 10000, source: 'Transfer', isTransfer: true },
        { amount: 10000, source: 'transfer' }, // source string check
        { amount: 2500, source: 'Bonus' },
      ];
      expect(calculateTotalIncome(incomes as Income[])).toBe(2500);
    });

    it('does not count a reversed failed payment as income', () => {
      const incomes: Partial<Income>[] = [
        { amount: 500, isReversal: true, source: 'Reversal' },
        { amount: 1200, source: 'Consulting' },
      ];
      expect(calculateTotalIncome(incomes as Income[])).toBe(1200);
    });

    it('excludes refunds linked to an expense so it does not double count', () => {
      const incomes: Partial<Income>[] = [
        { amount: 300, source: 'Refund', linkedExpenseId: 'exp-123' },
        { amount: 400, source: 'Refund' }, // unlinked standalone refund counts as income
        { amount: 1000, source: 'Salary' },
      ];
      expect(calculateTotalIncome(incomes as Income[])).toBe(1400);
    });
  });

  describe('calculateNetCashFlow', () => {
    it('computes net cash flow as totalIncome - totalExpenses', () => {
      expect(calculateNetCashFlow(5000, 3000)).toBe(2000);
      expect(calculateNetCashFlow(2000, 3500)).toBe(-1500);
    });

    it('neutralizes reversals so failed payment is net 0', () => {
      // Suppose ₹500 failed payment was debited, then reversed:
      // Expense is marked isReversed: true -> net expense = 0
      // Income reversal has isReversal: true -> net income = 0
      const expenses: Partial<Expense>[] = [
        { amount: 500, isReversed: true },
      ];
      const incomes: Partial<Income>[] = [
        { amount: 500, isReversal: true, source: 'Reversal' },
      ];
      const totalExp = calculateTotalExpenses(expenses as Expense[]);
      const totalInc = calculateTotalIncome(incomes as Income[]);
      expect(totalExp).toBe(0);
      expect(totalInc).toBe(0);
      expect(calculateNetCashFlow(totalInc, totalExp)).toBe(0);
    });

    it('neutralizes internal transfers so money movement between own accounts is net 0', () => {
      const expenses: Partial<Expense>[] = [
        { amount: 15000, isTransfer: true },
      ];
      const incomes: Partial<Income>[] = [
        { amount: 15000, isTransfer: true, source: 'Transfer' },
      ];
      const totalExp = calculateTotalExpenses(expenses as Expense[]);
      const totalInc = calculateTotalIncome(incomes as Income[]);
      expect(totalExp).toBe(0);
      expect(totalInc).toBe(0);
      expect(calculateNetCashFlow(totalInc, totalExp)).toBe(0);
    });
  });

  describe('calculateCategoryTotals', () => {
    it('calculates category totals excluding reversed and transfers, accounting for refunds', () => {
      const expenses: Partial<Expense>[] = [
        { id: '1', categoryId: 'cat-food', amount: 500, refundedAmount: 100 }, // net 400
        { id: '2', categoryId: 'cat-food', amount: 200 },                      // net 200 -> food total 600
        { id: '3', categoryId: 'cat-shopping', amount: 1000, isReversed: true },// reversed -> 0
        { id: '4', categoryId: 'cat-travel', amount: 5000, isTransfer: true },  // transfer -> 0
        { id: '5', categoryId: 'cat-shopping', amount: 350 },                  // shopping total 350
      ];

      const categoryTotals = calculateCategoryTotals(expenses as Expense[], mockCategories);

      expect(categoryTotals).toHaveLength(2);
      expect(categoryTotals[0]).toEqual({
        id: 'cat-food',
        name: 'Food & Dining',
        amount: 600,
        icon: '🍔',
      });
      expect(categoryTotals[1]).toEqual({
        id: 'cat-shopping',
        name: 'Shopping',
        amount: 350,
        icon: '🛍️',
      });
    });
  });

  describe('budget and goal progress', () => {
    it('calculates budget progress percentage', () => {
      expect(calculateBudgetProgress(50, 100)).toBe(50);
      expect(calculateBudgetProgress(150, 100)).toBe(100);
      expect(calculateBudgetProgress(0, 100)).toBe(0);
      expect(calculateBudgetProgress(50, 0)).toBe(0);
    });

    it('calculates goal progress percentage', () => {
      expect(calculateGoalProgress(200, 1000)).toBe(20);
      expect(calculateGoalProgress(1000, 1000)).toBe(100);
      expect(calculateGoalProgress(1200, 1000)).toBe(100);
    });
  });
});

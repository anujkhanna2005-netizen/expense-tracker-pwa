import type { Expense, Category } from '../types';
import type { Income } from '../types/income';

/**
 * Calculates net total expenses:
 * - Excludes reversed expenses (e.g., reversed failed payments).
 * - Excludes internal transfers between own accounts.
 * - Deducts any refunded amounts linked to the expense.
 */
export const calculateTotalExpenses = (expenses: Expense[]): number => {
  return expenses.reduce((sum, exp) => {
    if (exp.isReversed) return sum;
    if (exp.isTransfer) return sum;
    const netAmount = Math.max(0, exp.amount - (exp.refundedAmount || 0));
    return sum + netAmount;
  }, 0);
};

/**
 * Calculates net total income:
 * - Excludes internal transfers between own accounts.
 * - Excludes reversals of failed payments (not new income).
 * - Excludes refunds linked to an expense (which already offset the expense).
 */
export const calculateTotalIncome = (incomes: Income[]): number => {
  return incomes.reduce((sum, inc) => {
    if (inc.isTransfer || inc.source.toLowerCase() === 'transfer') return sum;
    if (inc.isReversal) return sum;
    if (inc.linkedExpenseId) return sum;
    return sum + inc.amount;
  }, 0);
};

/**
 * Calculates net cash flow: Net Income - Net Expenses.
 */
export const calculateNetCashFlow = (totalIncome: number, totalExpenses: number): number => {
  return totalIncome - totalExpenses;
};

/**
 * Calculates net spending per category:
 * Excludes reversed payments and internal transfers, and accounts for refunds.
 */
export const calculateCategoryTotals = (
  expenses: Expense[],
  categories: Category[]
): Array<{ id: string; name: string; amount: number; icon: string }> => {
  const totals: Record<string, number> = {};
  expenses.forEach((exp) => {
    if (exp.isReversed || exp.isTransfer) return;
    const netAmount = Math.max(0, exp.amount - (exp.refundedAmount || 0));
    totals[exp.categoryId] = (totals[exp.categoryId] || 0) + netAmount;
  });

  return Object.entries(totals)
    .map(([id, amount]) => {
      const cat = categories.find((c) => c.id === id);
      return {
        id,
        name: cat?.name || 'Unknown',
        amount,
        icon: cat?.icon || '📦',
      };
    })
    .sort((a, b) => b.amount - a.amount);
};

export const calculateBudgetProgress = (totalSpent: number, budgetLimit: number): number => {
  if (budgetLimit <= 0) return 0;
  return Math.min((totalSpent / budgetLimit) * 100, 100);
};

export const calculateGoalProgress = (currentAmount: number, targetAmount: number): number => {
  if (targetAmount <= 0) return 0;
  return Math.min((currentAmount / targetAmount) * 100, 100);
};


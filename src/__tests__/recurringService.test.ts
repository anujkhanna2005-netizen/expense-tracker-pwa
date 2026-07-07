import { describe, it, expect } from 'vitest';
import {
  generateDueRecurringExpenses,
  buildDedupKey,
} from '../services/recurringService';
import type { Bill, Expense } from '../types';

const TODAY = new Date('2026-07-07T00:00:00.000Z');
const THIS_MONTH = '2026-07'; // matches monthly period key for TODAY

function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'bill-1',
    name: 'Netflix',
    amount: 15,
    dueDate: '2026-07-07',
    isPaid: false,
    reminderEnabled: false,
    categoryId: 'cat-entertainment',
    isRecurring: true,
    recurringFrequency: 'monthly',
    ...overrides,
  };
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    amount: 15,
    categoryId: 'cat-entertainment',
    date: TODAY.toISOString(),
    paymentMethod: 'Bank Transfer',
    notes: buildDedupKey('bill-1', THIS_MONTH),
    createdAt: TODAY.toISOString(),
    updatedAt: TODAY.toISOString(),
    ...overrides,
  };
}

describe('recurringService — generateDueRecurringExpenses', () => {
  it('returns a new expense for a recurring bill with no matching expense', () => {
    const bills = [makeBill()];
    const expenses: Expense[] = [];
    const result = generateDueRecurringExpenses(bills, expenses, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(15);
    expect(result[0].notes).toContain(buildDedupKey('bill-1', THIS_MONTH));
  });

  it('is IDEMPOTENT — returns nothing when expense already exists for this period', () => {
    const bills = [makeBill()];
    const expenses = [makeExpense()]; // already has dedup key
    const result = generateDueRecurringExpenses(bills, expenses, TODAY);
    // Must return empty — running twice same period never duplicates
    expect(result).toHaveLength(0);
  });

  it('skips bills where isRecurring is false', () => {
    const bills = [makeBill({ isRecurring: false })];
    const result = generateDueRecurringExpenses(bills, [], TODAY);
    expect(result).toHaveLength(0);
  });

  it('skips bills where recurringFrequency is undefined', () => {
    const bills = [makeBill({ isRecurring: true, recurringFrequency: undefined })];
    const result = generateDueRecurringExpenses(bills, [], TODAY);
    expect(result).toHaveLength(0);
  });

  it('generates for weekly bills and uses week-based period key', () => {
    const bills = [makeBill({ recurringFrequency: 'weekly' })];
    const result = generateDueRecurringExpenses(bills, [], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].notes).toContain(':period:2026-W');
  });

  it('handles multiple bills independently', () => {
    const bill1 = makeBill({ id: 'b1', amount: 10 });
    const bill2 = makeBill({ id: 'b2', amount: 20 });
    // Only bill1 already recorded
    const expenses = [makeExpense({ notes: buildDedupKey('b1', THIS_MONTH) })];
    const result = generateDueRecurringExpenses([bill1, bill2], expenses, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].notes).toContain(buildDedupKey('b2', THIS_MONTH));
  });
});

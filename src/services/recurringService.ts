/**
 * recurringService.ts
 *
 * Generates Expense objects for recurring bills that have not yet been
 * auto-recorded for the current period.
 *
 * IDEMPOTENCY GUARANTEE
 * ---------------------
 * Each generated expense stores a dedup key in its `notes` field:
 *   `[auto] sourceBillId:<billId>:period:<YYYY-MM>` (monthly)
 *   `[auto] sourceBillId:<billId>:period:<YYYY-WW>`  (weekly, ISO week)
 *
 * Before inserting, we scan existing expenses for this exact key string.
 * Running generateDueRecurringExpenses twice on the same day (or on the same
 * already-processed period) will always return an empty array — zero duplicates.
 *
 * NOTE: The match is a simple `notes.includes(dedupKey)` check, so it survives
 * user edits of the rest of the note field as long as the key substring stays
 * intact. Users should not manually delete this tag from generated expenses.
 */

import type { Bill, Expense, PaymentMethod } from '../types';

/** Returns ISO week number for a given date (Monday-based, 1-indexed) */
function isoWeek(date: Date): number {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Returns the period key for a given date and frequency */
function getPeriodKey(date: Date, frequency: 'weekly' | 'monthly'): string {
  if (frequency === 'monthly') {
    return date.toISOString().slice(0, 7); // 'YYYY-MM'
  }
  // Weekly: 'YYYY-WW' (zero-padded to 2 digits)
  const week = String(isoWeek(date)).padStart(2, '0');
  return `${date.getFullYear()}-W${week}`;
}

/** Constructs the dedup tag embedded in the expense notes field */
export function buildDedupKey(billId: string, period: string): string {
  return `[auto] sourceBillId:${billId}:period:${period}`;
}

/**
 * Returns a list of new Expense objects that should be created for all
 * recurring bills that are due in the current period but not yet recorded.
 *
 * @param bills - All bills from billStore
 * @param expenses - All expenses from expenseStore
 * @param today - Reference date (defaults to now; injectable for tests)
 * @returns New Expense objects ready to be passed to expenseStore.addExpense()
 */
export function generateDueRecurringExpenses(
  bills: Bill[],
  expenses: Expense[],
  today: Date = new Date()
): Expense[] {
  const toCreate: Expense[] = [];

  for (const bill of bills) {
    if (!bill.isRecurring || !bill.recurringFrequency) continue;

    const period = getPeriodKey(today, bill.recurringFrequency);
    const dedupKey = buildDedupKey(bill.id, period);

    // Check idempotency: if an expense already contains this dedup key, skip
    const alreadyExists = expenses.some((e) => e.notes?.includes(dedupKey));
    if (alreadyExists) continue;

    const newExpense: Expense = {
      id: crypto.randomUUID(),
      amount: bill.amount,
      categoryId: bill.categoryId,
      date: today.toISOString(),
      paymentMethod: 'Bank Transfer' as PaymentMethod, // sensible default for recurring
      notes: dedupKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    toCreate.push(newExpense);
  }

  return toCreate;
}

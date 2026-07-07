import { useEffect, useRef } from 'react';
import { useExpenseStore } from '../stores/expenseStore';
import { useBillStore } from '../stores/billStore';
import { useUiStore } from '../stores/uiStore';
import { generateDueRecurringExpenses } from '../services/recurringService';

/**
 * Runs once per app session (after hydration) to auto-create expenses for
 * recurring bills that haven't been recorded yet this period.
 *
 * Idempotency is guaranteed by recurringService — running this hook twice on
 * the same day or same period never produces duplicate expenses.
 */
export function useRecurring() {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    // Read directly from store state (outside React render cycle) so we
    // don't need to subscribe and avoid extra re-renders.
    const bills = useBillStore.getState().bills;
    const expenses = useExpenseStore.getState().expenses;

    const toCreate = generateDueRecurringExpenses(bills, expenses);
    if (toCreate.length === 0) return;

    // Create each generated expense via the store (validates + persists)
    let created = 0;
    toCreate.forEach((expense) => {
      const ok = useExpenseStore.getState().addExpense(expense);
      if (ok) created++;
    });

    if (created > 0) {
      useUiStore
        .getState()
        .addToast(
          `Auto-recorded ${created} recurring expense${created > 1 ? 's' : ''} for this period.`,
          'info'
        );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentional empty-dep: runs once per mount (once per app session)
}

export default useRecurring;

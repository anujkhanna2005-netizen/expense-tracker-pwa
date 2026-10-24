import { useMemo } from 'react';
import { useIncomeStore } from '../stores/incomeStore';
import type { Income } from '../types/income';
import { calculateTotalIncome } from '../utils/calculations';

export function useIncome() {
  const incomes = useIncomeStore((state) => state.incomes);
  const addIncome = useIncomeStore((state) => state.addIncome);
  const updateIncome = useIncomeStore((state) => state.updateIncome);
  const deleteIncome = useIncomeStore((state) => state.deleteIncome);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const thisMonthIncomes = useMemo(
    () => incomes.filter((i) => i.date.startsWith(currentMonth)),
    [incomes, currentMonth]
  );

  const totalIncome = useMemo(
    () => calculateTotalIncome(thisMonthIncomes),
    [thisMonthIncomes]
  );

  /** Grouped by source for the current month (excluding internal transfers and reversals) */
  const incomeBySource = useMemo(() => {
    const map: Record<string, number> = {};
    thisMonthIncomes.forEach((i) => {
      if (i.isTransfer || i.source.toLowerCase() === 'transfer' || i.isReversal || i.linkedExpenseId) return;
      map[i.source] = (map[i.source] || 0) + i.amount;
    });
    return Object.entries(map)
      .map(([source, amount]) => ({ source, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [thisMonthIncomes]);

  /** All incomes for a specific month — 'YYYY-MM' */
  function getByMonth(monthYear: string): Income[] {
    return incomes.filter((i) => i.date.startsWith(monthYear));
  }

  return {
    incomes,
    thisMonthIncomes,
    totalIncome,
    incomeBySource,
    getByMonth,
    addIncome,
    updateIncome,
    deleteIncome,
  };
}

export default useIncome;

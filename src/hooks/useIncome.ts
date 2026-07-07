import { useMemo } from 'react';
import { useIncomeStore } from '../stores/incomeStore';
import type { Income } from '../types/income';

export function useIncome() {
  const incomes = useIncomeStore((state) => state.incomes);
  const addIncome = useIncomeStore((state) => state.addIncome);
  const updateIncome = useIncomeStore((state) => state.updateIncome);
  const deleteIncome = useIncomeStore((state) => state.deleteIncome);

  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const thisMonthIncomes = useMemo(
    () => incomes.filter((i) => i.date.startsWith(currentMonth)),
    [incomes, currentMonth]
  );

  const totalIncome = useMemo(
    () => thisMonthIncomes.reduce((sum, i) => sum + i.amount, 0),
    [thisMonthIncomes]
  );

  /** Grouped by source for the current month */
  const incomeBySource = useMemo(() => {
    const map: Record<string, number> = {};
    thisMonthIncomes.forEach((i) => {
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

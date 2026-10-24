import { useExpenseStore } from '../stores/expenseStore';
import { useCategoryStore } from '../stores/categoryStore';
import { useMemo } from 'react';
import { calculateTotalExpenses, calculateCategoryTotals } from '../utils/calculations';

export function useExpenses() {
  const expenses = useExpenseStore((state) => state.expenses);
  const addExpense = useExpenseStore((state) => state.addExpense);
  const updateExpense = useExpenseStore((state) => state.updateExpense);
  const deleteExpense = useExpenseStore((state) => state.deleteExpense);
  const categories = useCategoryStore((state) => state.categories);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const thisMonthExpenses = useMemo(() => {
    return expenses.filter((exp) => exp.date.startsWith(currentMonth));
  }, [expenses, currentMonth]);

  const totalSpent = useMemo(() => {
    return calculateTotalExpenses(thisMonthExpenses);
  }, [thisMonthExpenses]);

  const categoryTotals = useMemo(() => {
    return calculateCategoryTotals(thisMonthExpenses, categories);
  }, [thisMonthExpenses, categories]);

  const topCategory = useMemo(() => {
    return categoryTotals.length > 0 ? categoryTotals[0] : null;
  }, [categoryTotals]);

  return {
    expenses,
    thisMonthExpenses,
    totalSpent,
    categoryTotals,
    topCategory,
    addExpense,
    updateExpense,
    deleteExpense
  };
}
export default useExpenses;

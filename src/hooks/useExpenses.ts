import { useExpenseStore } from '../stores/expenseStore';
import { useCategoryStore } from '../stores/categoryStore';
import { useMemo } from 'react';

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
    return thisMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [thisMonthExpenses]);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    thisMonthExpenses.forEach((exp) => {
      totals[exp.categoryId] = (totals[exp.categoryId] || 0) + exp.amount;
    });

    return Object.entries(totals)
      .map(([id, amount]) => {
        const cat = categories.find((c) => c.id === id);
        return {
          id,
          name: cat?.name || 'Unknown',
          amount,
          icon: cat?.icon || '📦'
        };
      })
      .sort((a, b) => b.amount - a.amount);
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

import React, { useMemo, useState } from 'react';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import CategoryDonutChart from '../components/CategoryDonutChart';
import ProgressBar from '../components/ui/ProgressBar';
import { useExpenses } from '../hooks/useExpenses';
import { useIncome } from '../hooks/useIncome';
import { useCategories } from '../hooks/useCategories';
import { useSettings } from '../hooks/useSettings';
import { useHydration } from '../hooks/useHydration';
import { formatCurrency, formatCompactCurrency } from '../utils/format';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './Reports.module.css';

const Reports: React.FC = () => {
  const { expenses } = useExpenses();
  const { incomes } = useIncome();
  const { categories } = useCategories();
  const { settings } = useSettings();
  const hydrated = useHydration();
  const isLoading = !hydrated;

  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7)); // 'YYYY-MM'

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(new Date().toISOString().slice(0, 7));
    expenses.forEach((e) => months.add(e.date.slice(0, 7)));
    incomes.forEach((i) => months.add(i.date.slice(0, 7)));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [expenses, incomes]);

  const handlePrevMonth = () => {
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[idx + 1]);
    }
  };

  const handleNextMonth = () => {
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx > 0) {
      setSelectedMonth(availableMonths[idx - 1]);
    }
  };

  const monthData = useMemo(() => {
    const filteredExpenses = expenses.filter((e) => e.date.startsWith(selectedMonth));
    const filteredIncomes = incomes.filter((i) => i.date.startsWith(selectedMonth));

    const totalSpent = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalIncome = filteredIncomes.reduce((sum, i) => sum + i.amount, 0);
    const netCashFlow = totalIncome - totalSpent;
    const savingsRate = totalIncome > 0 && netCashFlow > 0 ? (netCashFlow / totalIncome) * 100 : 0;

    // Category totals
    const totals: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      totals[e.categoryId] = (totals[e.categoryId] || 0) + e.amount;
    });

    const categoryTotals = Object.entries(totals)
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

    return {
      totalSpent,
      totalIncome,
      netCashFlow,
      savingsRate,
      categoryTotals,
      filteredExpenses,
    };
  }, [expenses, incomes, categories, selectedMonth]);

  const handleExportMonthCSV = () => {
    const headers = ['type', 'date', 'category_or_source', 'amount', 'notes'];
    const rows = [
      ...monthData.filteredExpenses.map((exp) => {
        const cat = categories.find((c) => c.id === exp.categoryId);
        return [
          'expense',
          exp.date,
          cat?.name || '',
          exp.amount.toString(),
          (exp.notes || '').replace(/,/g, ';').replace(/\n/g, ' '),
        ];
      }),
      ...incomes
        .filter((inc) => inc.date.startsWith(selectedMonth))
        .map((inc) => [
          'income',
          inc.date,
          inc.source,
          inc.amount.toString(),
          (inc.notes || '').replace(/,/g, ';').replace(/\n/g, ' '),
        ]),
    ].sort((a, b) => a[1].localeCompare(b[1]));

    const csvContent = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${selectedMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formattedMonth = new Date(selectedMonth + '-02').toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  if (isLoading) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <Skeleton variant="line" width={180} height={32} />
        </header>
        <div className={styles.selectorWrapper}>
          <Skeleton variant="line" width={220} height={40} />
        </div>
        <div className={styles.statsGrid}>
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
        <div className={styles.grid}>
          <Skeleton variant="card" height={250} />
          <Skeleton variant="card" height={250} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Monthly Reports</h1>
          <p className={styles.subtitle}>Analyze income, spending patterns and savings rate</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<FileText size={16} />}
          onClick={handleExportMonthCSV}
          disabled={monthData.filteredExpenses.length === 0}
        >
          Export CSV
        </Button>
      </header>

      {/* Month Selector */}
      <div className={styles.selectorWrapper}>
        <button
          onClick={handlePrevMonth}
          className={styles.arrowBtn}
          disabled={availableMonths.indexOf(selectedMonth) === availableMonths.length - 1}
          aria-label="Previous month"
        >
          <ChevronLeft size={20} />
        </button>
        <span className={styles.selectedMonthLabel}>{formattedMonth}</span>
        <button
          onClick={handleNextMonth}
          className={styles.arrowBtn}
          disabled={availableMonths.indexOf(selectedMonth) === 0}
          aria-label="Next month"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className={styles.statsGrid}>
        <Card variant="flat">
          <span className={styles.statLabel}>Total Spent</span>
          <h2 className={styles.statValue} style={{ color: 'var(--color-danger)' }}>
            {formatCompactCurrency(monthData.totalSpent, settings.currency)}
          </h2>
        </Card>
        <Card variant="flat">
          <span className={styles.statLabel}>Total Income</span>
          <h2 className={styles.statValue} style={{ color: 'var(--color-success)' }}>
            {formatCompactCurrency(monthData.totalIncome, settings.currency)}
          </h2>
        </Card>
        <Card variant="flat">
          <span className={styles.statLabel}>Net Flow</span>
          <h2
            className={styles.statValue}
            style={{ color: monthData.netCashFlow >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
          >
            {monthData.netCashFlow >= 0 ? '+' : ''}
            {formatCompactCurrency(monthData.netCashFlow, settings.currency)}
          </h2>
        </Card>
        <Card variant="flat">
          <span className={styles.statLabel}>Savings Rate</span>
          <h2 className={styles.statValue} style={{ color: 'var(--accent-primary)' }}>
            {monthData.savingsRate.toFixed(1)}%
          </h2>
        </Card>
      </div>

      <div className={styles.grid}>
        {/* Category Donut Chart */}
        <Card variant="flat">
          <h3 className={styles.sectionTitle}>Expense breakdown</h3>
          {monthData.categoryTotals.length > 0 ? (
            <CategoryDonutChart data={monthData.categoryTotals} currency={settings.currency} />
          ) : (
            <div className={styles.emptyState}>No expenses recorded for this month.</div>
          )}
        </Card>

        {/* Top 5 Categories Table / Limits */}
        <Card variant="flat">
          <h3 className={styles.sectionTitle}>Top Categories</h3>
          {monthData.categoryTotals.length > 0 ? (
            <div className={styles.catList}>
              {monthData.categoryTotals.slice(0, 5).map((cat) => {
                const limit = settings.categoryBudgets?.[cat.id] || 0;

                return (
                  <div key={cat.id} className={styles.catItem}>
                    <div className={styles.catHeader}>
                      <span className={styles.catName}>
                        {cat.icon} {cat.name}
                      </span>
                      <div className={styles.catValue}>
                        <span className={styles.catSpent}>
                          {formatCurrency(cat.amount, settings.currency)}
                        </span>
                        {limit > 0 && (
                          <span className={styles.catLimit}>
                            {' '}
                            / {formatCompactCurrency(limit, settings.currency)}
                          </span>
                        )}
                      </div>
                    </div>
                    {limit > 0 && (
                      <div className={styles.progressBarWrapper}>
                        <ProgressBar value={cat.amount} max={limit} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>No categories to show.</div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Reports;

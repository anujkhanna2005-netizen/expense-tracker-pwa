import React, { useMemo, useState } from 'react';
import CategoryDonutChart from '../components/CategoryDonutChart';
import { useExpenses } from '../hooks/useExpenses';
import { useIncome } from '../hooks/useIncome';
import { useCategories } from '../hooks/useCategories';
import { useSettings } from '../hooks/useSettings';
import { useHydration } from '../hooks/useHydration';
import { formatCurrency, formatCompactCurrency } from '../utils/format';
import { calculateTotalExpenses, calculateTotalIncome, calculateCategoryTotals } from '../utils/calculations';
import styles from './Reports.module.css';

function getCategoryColor(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('food') || lower.includes('dining') || lower.includes('cafe')) {
    return { bg: '#FEF3C7', text: '#D97706', dot: '#F59E0B', icon: 'restaurant' };
  }
  if (lower.includes('shop') || lower.includes('cloth')) {
    return { bg: '#EDE9FE', text: '#7C3AED', dot: '#8B5CF6', icon: 'shopping_bag' };
  }
  if (lower.includes('grocer') || lower.includes('mart')) {
    return { bg: '#CCFBF1', text: '#0F766E', dot: '#0D9488', icon: 'shopping_cart' };
  }
  if (lower.includes('bill') || lower.includes('util') || lower.includes('recharge')) {
    return { bg: '#DBEAFE', text: '#2563EB', dot: '#3B82F6', icon: 'receipt_long' };
  }
  if (lower.includes('fuel') || lower.includes('petrol') || lower.includes('travel')) {
    return { bg: '#FFEDD5', text: '#EA580C', dot: '#F97316', icon: 'local_gas_station' };
  }
  if (lower.includes('health') || lower.includes('med')) {
    return { bg: '#FCE7F3', text: '#DB2777', dot: '#EC4899', icon: 'medical_services' };
  }
  return { bg: '#E0F2FE', text: '#0284C7', dot: '#0EA5E9', icon: 'category' };
}

const Reports: React.FC = () => {
  const { expenses } = useExpenses();
  const { incomes } = useIncome();
  const { categories } = useCategories();
  const { settings } = useSettings();
  const hydrated = useHydration();
  const isLoading = !hydrated;

  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year' | 'custom'>('month');
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

    const totalSpent = calculateTotalExpenses(filteredExpenses);
    const totalIncome = calculateTotalIncome(filteredIncomes);
    const netCashFlow = totalIncome - totalSpent;
    const savingsRate = totalIncome > 0 && netCashFlow > 0 ? (netCashFlow / totalIncome) * 100 : 0;
    const expensePercent = totalIncome > 0 ? Math.min(100, (totalSpent / totalIncome) * 100) : totalSpent > 0 ? 100 : 0;

    const categoryTotals = calculateCategoryTotals(filteredExpenses, categories);

    // Compute weekly distribution for the Spending Trend chart
    const weekTotals = [0, 0, 0, 0];
    filteredExpenses.forEach((exp) => {
      const day = parseInt(exp.date.slice(8, 10), 10);
      if (day <= 7) weekTotals[0] += exp.amount;
      else if (day <= 14) weekTotals[1] += exp.amount;
      else if (day <= 21) weekTotals[2] += exp.amount;
      else weekTotals[3] += exp.amount;
    });

    const maxWeekSpend = Math.max(...weekTotals, 1);
    const peakWeekIdx = weekTotals.indexOf(Math.max(...weekTotals));

    return {
      totalSpent,
      totalIncome,
      netCashFlow,
      savingsRate,
      expensePercent,
      categoryTotals,
      filteredExpenses,
      weekTotals,
      maxWeekSpend,
      peakWeekIdx,
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
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-secondary)' }}>
          Loading financial reports...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Spending Analytics</h1>
          <p className={styles.subtitle}>Analyze income, cash flows, and category patterns</p>
        </div>
        <button
          type="button"
          className={styles.exportBtn}
          onClick={handleExportMonthCSV}
          disabled={monthData.filteredExpenses.length === 0}
          title="Export monthly records as CSV"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            download
          </span>
          <span>Export CSV</span>
        </button>
      </header>

      {/* Timeframe Switcher Tray */}
      <div className={styles.timeframeTray} role="tablist" aria-label="Timeframe filter">
        <button
          type="button"
          className={`${styles.timeframeBtn} ${timeframe === 'week' ? styles.timeframeBtnActive : ''}`}
          onClick={() => setTimeframe('week')}
        >
          Week
        </button>
        <button
          type="button"
          className={`${styles.timeframeBtn} ${timeframe === 'month' ? styles.timeframeBtnActive : ''}`}
          onClick={() => setTimeframe('month')}
        >
          Month
        </button>
        <button
          type="button"
          className={`${styles.timeframeBtn} ${timeframe === 'year' ? styles.timeframeBtnActive : ''}`}
          onClick={() => setTimeframe('year')}
        >
          Year
        </button>
        <button
          type="button"
          className={`${styles.timeframeBtn} ${timeframe === 'custom' ? styles.timeframeBtnActive : ''}`}
          onClick={() => setTimeframe('custom')}
        >
          Custom
        </button>
      </div>

      {/* Active Selection Subheader Bar */}
      <div className={styles.periodBar}>
        <div className={styles.periodControls}>
          <button
            type="button"
            onClick={handlePrevMonth}
            className={styles.arrowBtn}
            disabled={availableMonths.indexOf(selectedMonth) === availableMonths.length - 1}
            aria-label="Previous month"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              chevron_left
            </span>
          </button>
          <span className={styles.periodTitle}>{formattedMonth}</span>
          <button
            type="button"
            onClick={handleNextMonth}
            className={styles.arrowBtn}
            disabled={availableMonths.indexOf(selectedMonth) === 0}
            aria-label="Next month"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              chevron_right
            </span>
          </button>
        </div>

        <div className={styles.momPill}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
            {monthData.netCashFlow >= 0 ? 'trending_up' : 'trending_down'}
          </span>
          <span>
            {monthData.savingsRate > 0
              ? `${monthData.savingsRate.toFixed(1)}% Saved`
              : monthData.netCashFlow >= 0
              ? 'Balanced'
              : 'Deficit'}
          </span>
        </div>
      </div>

      {/* Cash Flow & Savings Summary Hero Card */}
      <section className={styles.heroCard}>
        <div className={styles.heroGlow} />
        <div className={styles.heroCardHeader}>
          <span className={styles.heroTag}>Net Monthly Cash Flow</span>
          <div className={styles.verifiedPill}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-mint-highlight)' }}>
              shield
            </span>
            <span>Verified Ledger</span>
          </div>
        </div>

        <div className={styles.heroGrid}>
          <div className={styles.heroCol}>
            <span className={styles.heroColLabel}>Total Inflow</span>
            <span className={styles.heroColValue}>
              {formatCurrency(monthData.totalIncome, settings.currency)}
            </span>
            <span className={styles.heroColSub}>Credits &amp; Income</span>
          </div>
          <div className={styles.heroCol}>
            <span className={styles.heroColLabel}>Total Outflow</span>
            <span className={styles.heroColValue}>
              {formatCurrency(monthData.totalSpent, settings.currency)}
            </span>
            <span className={styles.heroColSub}>
              {monthData.expensePercent.toFixed(1)}% of earnings
            </span>
          </div>
        </div>

        {/* Ratio Progress Bar */}
        <div className={styles.ratioSection}>
          <div className={styles.ratioTrack}>
            <div
              className={styles.ratioSavings}
              style={{ width: `${Math.max(0, Math.min(100, monthData.savingsRate))}%` }}
              title={`Savings: ${monthData.savingsRate.toFixed(1)}%`}
            />
            <div
              className={styles.ratioExpense}
              style={{ width: `${Math.max(0, Math.min(100, monthData.expensePercent))}%` }}
              title={`Expenses: ${monthData.expensePercent.toFixed(1)}%`}
            />
          </div>
          <div className={styles.ratioLegend}>
            <span>
              <span className={styles.legendDot} />
              Savings: {monthData.savingsRate.toFixed(1)}%
            </span>
            <span style={{ fontWeight: 700, color: '#ffffff' }}>
              Net: {monthData.netCashFlow >= 0 ? '+' : ''}
              {formatCompactCurrency(monthData.netCashFlow, settings.currency)}
            </span>
          </div>
        </div>
      </section>

      {/* Spending Over Time Trend Card */}
      <section className={styles.trendCard}>
        <div className={styles.trendHeader}>
          <div className={styles.trendTitleGroup}>
            <h2 className={styles.cardTitle}>Spending Trend</h2>
            <span className={styles.cardSubtitle}>Weekly distribution across {formattedMonth}</span>
          </div>
          <div className={styles.badgePill}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              calendar_view_week
            </span>
            <span>4 Weeks</span>
          </div>
        </div>

        {/* SVG Chart Area */}
        <div className={styles.chartArea}>
          {monthData.totalSpent > 0 && monthData.weekTotals[monthData.peakWeekIdx] > 0 && (
            <div className={styles.peakBadgeRow}>
              <div className={styles.peakBadge}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#f59e0b' }}>
                  celebration
                </span>
                <span>
                  Week {monthData.peakWeekIdx + 1} Peak: {formatCurrency(monthData.weekTotals[monthData.peakWeekIdx], settings.currency)}
                </span>
              </div>
            </div>
          )}

          <div style={{ width: '100%', height: '140px' }}>
            <svg viewBox="0 0 340 140" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {/* Horizontal Reference Gridlines */}
              <line x1="30" y1="20" x2="330" y2="20" stroke="#E2E8F0" strokeDasharray="3 3" strokeWidth="1" />
              <line x1="30" y1="60" x2="330" y2="60" stroke="#E2E8F0" strokeDasharray="3 3" strokeWidth="1" />
              <line x1="30" y1="100" x2="330" y2="100" stroke="#E2E8F0" strokeDasharray="3 3" strokeWidth="1" />
              <line x1="30" y1="120" x2="330" y2="120" stroke="#E2E8F0" strokeWidth="1" />

              {/* 4 Weekly Bars */}
              {monthData.weekTotals.map((amount, idx) => {
                const barHeight = monthData.totalSpent > 0 ? Math.max(8, (amount / monthData.maxWeekSpend) * 90) : 6;
                const x = 50 + idx * 72;
                const y = 120 - barHeight;
                const isPeak = idx === monthData.peakWeekIdx && amount > 0;

                return (
                  <g key={`week-${idx}`}>
                    {/* Background Bar */}
                    <rect x={x} y="20" width="38" height="100" rx="6" fill="#F1F5F9" opacity="0.6" />
                    {/* Filled Bar */}
                    <rect
                      x={x}
                      y={y}
                      width="38"
                      height={barHeight}
                      rx="6"
                      fill={isPeak ? '#0F766E' : '#CCFBF1'}
                    />
                    {isPeak && <circle cx={x + 19} cy={y} r="3" fill="#D97706" />}
                    {/* X-axis label */}
                    <text
                      x={x + 19}
                      y="134"
                      textAnchor="middle"
                      fill={isPeak ? '#0F766E' : '#64748B'}
                      fontFamily="Plus Jakarta Sans"
                      fontSize="10"
                      fontWeight={isPeak ? '700' : '600'}
                    >
                      W{idx + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Weekly Legend Tiles */}
          <div className={styles.weeklyTilesGrid}>
            {monthData.weekTotals.map((amt, idx) => {
              const isPeak = idx === monthData.peakWeekIdx && amt > 0;
              return (
                <div
                  key={`tile-${idx}`}
                  className={`${styles.weeklyTile} ${isPeak ? styles.weeklyTilePeak : ''}`}
                >
                  <span className={styles.weeklyTileLabel}>W{idx + 1}</span>
                  <span
                    className={`${styles.weeklyTileValue} ${isPeak ? styles.weeklyTileValuePeak : ''}`}
                  >
                    {formatCompactCurrency(amt, settings.currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Category Breakdown Card */}
      <section className={styles.categoryCard}>
        <div className={styles.categoryHeader}>
          <h2 className={styles.cardTitle}>Category Allocation</h2>
          <span className={styles.badgePill}>
            {monthData.categoryTotals.length} Categor{monthData.categoryTotals.length === 1 ? 'y' : 'ies'}
          </span>
        </div>

        {monthData.categoryTotals.length > 0 ? (
          <>
            {/* Donut Chart + Central Stat */}
            <div className={styles.donutWrapper}>
              <CategoryDonutChart data={monthData.categoryTotals} currency={settings.currency} />

              {/* Callout Summary Snippets */}
              <div className={styles.summarySnippets}>
                {monthData.categoryTotals[0] && (
                  <div className={styles.snippetItem}>
                    <div className={styles.snippetDot} style={{ background: '#F59E0B' }} />
                    <div className={styles.snippetTexts}>
                      <span className={styles.snippetLabel}>Top Outflow</span>
                      <span className={styles.snippetValue}>{monthData.categoryTotals[0].name}</span>
                    </div>
                  </div>
                )}
                {monthData.categoryTotals[1] && (
                  <div className={styles.snippetItem}>
                    <div className={styles.snippetDot} style={{ background: '#0D9488' }} />
                    <div className={styles.snippetTexts}>
                      <span className={styles.snippetLabel}>Second Largest</span>
                      <span className={styles.snippetValue}>{monthData.categoryTotals[1].name}</span>
                    </div>
                  </div>
                )}
                {monthData.categoryTotals.length > 2 && (
                  <div className={styles.snippetItem}>
                    <div className={styles.snippetDot} style={{ background: '#8B5CF6' }} />
                    <div className={styles.snippetTexts}>
                      <span className={styles.snippetLabel}>Other Expenses</span>
                      <span className={styles.snippetValue}>
                        {monthData.categoryTotals.length - 2} Categories
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Category Ledger Rows */}
            <div className={styles.categoryLedger}>
              {monthData.categoryTotals.map((cat) => {
                const theme = getCategoryColor(cat.name);
                const percent =
                  monthData.totalSpent > 0 ? ((cat.amount / monthData.totalSpent) * 100).toFixed(1) : '0';

                return (
                  <div key={cat.id} className={styles.catRow}>
                    <div className={styles.catRowLeft}>
                      <div
                        className={styles.catIconBox}
                        style={{ background: theme.bg, color: theme.text }}
                      >
                        <span className="material-symbols-outlined">{theme.icon}</span>
                      </div>
                      <div className={styles.catTextGroup}>
                        <span className={styles.catName}>{cat.name}</span>
                        <span className={styles.catSub}>
                          {monthData.filteredExpenses.filter((e) => e.categoryId === cat.id).length} transaction{monthData.filteredExpenses.filter((e) => e.categoryId === cat.id).length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    <div className={styles.catRowRight}>
                      <span className={styles.catAmount}>
                        {formatCurrency(cat.amount, settings.currency)}
                      </span>
                      <span className={styles.catPercent} style={{ color: theme.text }}>
                        {percent}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>No expense transactions recorded for {formattedMonth}.</div>
        )}
      </section>
    </div>
  );
};

export default Reports;

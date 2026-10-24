import React, { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  ShieldCheck, 
  TrendingDown, 
  TrendingUp, 
  PiggyBank, 
  PieChart, 
  CheckCircle2, 
  AlertCircle,
  Receipt
} from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import { useExpenses } from '../hooks/useExpenses';
import { useCategories } from '../hooks/useCategories';
import { useSettings } from '../hooks/useSettings';
import { useHydration } from '../hooks/useHydration';
import { useIncome } from '../hooks/useIncome';
import { useBills } from '../hooks/useBills';
import { CapturedReviewBanner } from '../components/CapturedReviewBanner';
import { formatCurrency } from '../utils/format';
import styles from './Dashboard.module.css';

const Dashboard: React.FC = () => {
  const { expenses, totalSpent, categoryTotals, topCategory: _topCategory } = useExpenses();
  const { categories } = useCategories();
  const { settings } = useSettings();
  const hydrated = useHydration();
  const isLoading = !hydrated;
  const { totalIncome, incomes } = useIncome();
  const { currentMonthBills } = useBills();
  const navigate = useNavigate();

  const [currentDate, setCurrentDate] = useState(() => new Date());

  const monthLabel = useMemo(() => {
    return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  const changeMonth = (delta: number) => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  };

  const netCashFlow = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netCashFlow / totalIncome) * 100)) : 0;

  const budgetLimit = settings.monthlyBudgetLimit || 0;
  const budgetRemaining = budgetLimit > 0 ? Math.max(0, budgetLimit - totalSpent) : 0;
  const budgetPercent = budgetLimit > 0 ? Math.min((totalSpent / budgetLimit) * 100, 100) : 0;

  // Days remaining in month
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const currentDay = currentDate.getMonth() === new Date().getMonth() ? new Date().getDate() : 1;
  const daysRemaining = Math.max(1, daysInMonth - currentDay);
  const dailySafeSpend = budgetRemaining > 0 ? Math.round(budgetRemaining / daysRemaining) : 0;

  // Combined recent ledger items
  const recentTransactions = useMemo(() => {
    const list = [
      ...expenses.map((exp) => {
        const cat = categories.find((c) => c.id === exp.categoryId);
        return {
          kind: 'expense' as const,
          id: exp.id,
          date: exp.date,
          amount: exp.amount,
          title: exp.notes || cat?.name || 'Expense',
          categoryName: cat?.name || 'General',
          method: exp.paymentMethod || 'UPI',
          icon: exp.isReversed ? '↩️' : exp.isTransfer ? '↔️' : cat?.icon || '📦',
          isReversed: exp.isReversed,
          isTransfer: exp.isTransfer,
        };
      }),
      ...incomes.map((inc) => ({
        kind: 'income' as const,
        id: inc.id,
        date: inc.date,
        amount: inc.amount,
        title: inc.notes || inc.source || 'Income',
        categoryName: inc.source || 'Income',
        method: 'IMPS',
        icon: inc.isTransfer ? '↔️' : inc.isReversal ? '↩️' : '💰',
        isReversal: inc.isReversal,
        isTransfer: inc.isTransfer,
      })),
    ];

    return list
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [expenses, incomes, categories]);

  if (isLoading) {
    return (
      <div className={styles.dashboard}>
        <Skeleton variant="card" height={50} />
        <Skeleton variant="card" height={220} />
        <Skeleton variant="card" height={100} />
        <Skeleton variant="card" height={180} />
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      {/* Month Bar with Live Sync Pill */}
      <section className={styles.monthBar}>
        <div className={styles.monthSelector}>
          <button
            type="button"
            className={styles.monthArrowBtn}
            onClick={() => changeMonth(-1)}
            aria-label="Previous Month"
          >
            <ChevronLeft size={18} />
          </button>
          <div className={styles.monthDisplay}>
            <Calendar size={18} className={styles.monthIcon} />
            <span className={styles.monthText}>{monthLabel}</span>
          </div>
          <button
            type="button"
            className={styles.monthArrowBtn}
            onClick={() => changeMonth(1)}
            aria-label="Next Month"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className={styles.liveSyncPill}>
          <span className={styles.liveSyncPulse} />
          <span className={styles.liveSyncText}>Live Sync</span>
        </div>
      </section>

      {/* Hero Financial Summary Card (Deep Emerald Luxe Gradient) */}
      <section className={styles.heroCard}>
        <div className={styles.ambientGlowTop} />
        <div className={styles.ambientGlowBottom} />

        <div className={styles.heroContent}>
          {/* Balance Header */}
          <div className={styles.heroHeader}>
            <div className={styles.balanceGroup}>
              <span className={styles.balanceLabel}>Total Available Balance</span>
              <div className={styles.balanceAmount}>
                {formatCurrency(netCashFlow, settings.currency)}
              </div>
            </div>
            <div className={styles.verifiedBadge}>
              <ShieldCheck size={16} className={styles.shieldIcon} />
              <span>Verified</span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabelRow}>
                <TrendingDown size={15} className={styles.trendDownIcon} />
                <span>Monthly Spends</span>
              </div>
              <span className={styles.metricValue}>
                {formatCurrency(totalSpent, settings.currency)}
              </span>
              <span className={styles.metricSubtext}>
                {totalIncome > 0 ? `${((totalSpent / totalIncome) * 100).toFixed(1)}% of income` : 'Recorded expenses'}
              </span>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricLabelRow}>
                <TrendingUp size={15} className={styles.trendUpIcon} />
                <span>Monthly Income</span>
              </div>
              <span className={styles.metricValue}>
                {formatCurrency(totalIncome, settings.currency)}
              </span>
              <span className={styles.metricSubtext}>
                {incomes.length} inflow {incomes.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
          </div>

          {/* Net Savings Footnote */}
          <div className={styles.savingsFootnote}>
            <div className={styles.savingsLeft}>
              <PiggyBank size={18} className={styles.piggyIcon} />
              <span>Net Savings this Month</span>
            </div>
            <div className={styles.savingsRight}>
              <span className={styles.savingsValue}>
                {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow, settings.currency)}
              </span>
              <span className={styles.savingsRateBadge}>
                {savingsRate}% Rate
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* UPI Review Banner */}
      <CapturedReviewBanner />

      {/* Monthly Budget Progress Card */}
      <section className={styles.budgetCard}>
        <div className={styles.budgetHeader}>
          <div className={styles.budgetTitleGroup}>
            <div className={styles.budgetIconWrap}>
              <PieChart size={18} />
            </div>
            <div>
              <span className={styles.budgetTitle}>Monthly Budget</span>
              <span className={styles.budgetLimitText}>
                {budgetLimit > 0 ? `${formatCurrency(budgetLimit, settings.currency)} limit` : 'No budget set'}
              </span>
            </div>
          </div>

          <div className={styles.budgetRight}>
            {budgetLimit > 0 ? (
              <>
                <span className={styles.budgetRemainingAmount}>
                  {formatCurrency(budgetRemaining, settings.currency)} left
                </span>
                <span className={styles.daysRemainingText}>
                  {daysRemaining} days remaining
                </span>
              </>
            ) : (
              <button
                type="button"
                className={styles.setBudgetBtn}
                onClick={() => navigate('/settings')}
              >
                Set Limit
              </button>
            )}
          </div>
        </div>

        {budgetLimit > 0 && (
          <div className={styles.budgetProgressSection}>
            <div className={styles.budgetProgressBar}>
              <div 
                className={styles.budgetProgressFill} 
                style={{ width: `${budgetPercent}%` }} 
              />
            </div>
            <div className={styles.budgetLabels}>
              <span>{formatCurrency(totalSpent, settings.currency)} spent</span>
              <span className={styles.budgetPercentText}>{budgetPercent.toFixed(1)}% consumed</span>
              <span>{formatCurrency(budgetLimit, settings.currency)} cap</span>
            </div>

            <div className={styles.paceInsight}>
              {budgetPercent >= 100 ? (
                <>
                  <AlertCircle size={16} className={styles.alertIcon} />
                  <span>Budget exceeded for this month. Review non-essential spending.</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} className={styles.checkIcon} />
                  <span>
                    On pace! Daily safe spend remaining is{' '}
                    <strong>{formatCurrency(dailySafeSpend, settings.currency)}/day</strong>.
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Top Spending Categories Carousel */}
      {categoryTotals.length > 0 && (
        <section className={styles.categorySection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Top Category Spends</span>
            <NavLink to="/reports" className={styles.sectionActionLink}>
              View Breakdown
            </NavLink>
          </div>

          <div className={styles.categoryCarousel}>
            {categoryTotals.slice(0, 6).map((cat) => (
              <div key={cat.id} className={styles.categoryCard}>
                <div className={styles.categoryIconWrap}>
                  {cat.icon || '📦'}
                </div>
                <div className={styles.categoryInfo}>
                  <span className={styles.categoryName}>{cat.name}</span>
                  <span className={styles.categoryAmount}>
                    {formatCurrency(cat.amount, settings.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Bills Peek */}
      {currentMonthBills.length > 0 && (
        <section className={styles.billsSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.billsTitleGroup}>
              <Receipt size={18} className={styles.billsIcon} />
              <span className={styles.sectionTitle}>Upcoming Dues</span>
            </div>
            <NavLink to="/bills" className={styles.sectionActionLink}>
              Manage Bills
            </NavLink>
          </div>

          <div className={styles.billsGrid}>
            {currentMonthBills.slice(0, 2).map((bill) => (
              <div key={bill.id} className={styles.billCard}>
                <div className={styles.billCardTop}>
                  <div className={styles.billIconCircle}>
                    {bill.isPaid ? '✓' : '⚡'}
                  </div>
                  <span className={bill.isPaid ? styles.billPaidBadge : styles.billDueBadge}>
                    {bill.isPaid ? 'Paid' : `Due ${bill.dueDate.slice(8, 10)}`}
                  </span>
                </div>
                <div className={styles.billCardBottom}>
                  <span className={styles.billName}>{bill.name}</span>
                  <span className={styles.billAmount}>
                    {formatCurrency(bill.amount, settings.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Ledger Transactions */}
      <section className={styles.recentSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Recent Transactions</span>
          <NavLink to="/expenses" className={styles.sectionActionLink}>
            View All ({expenses.length + incomes.length})
          </NavLink>
        </div>

        <div className={styles.transactionsCard}>
          {recentTransactions.length === 0 ? (
            <div className={styles.emptyTransactions}>
              <p>No transactions recorded yet this month.</p>
              <button
                type="button"
                className={styles.emptyAddBtn}
                onClick={() => window.dispatchEvent(new Event('openAddExpense'))}
              >
                Add Transaction
              </button>
            </div>
          ) : (
            recentTransactions.map((tx, idx) => (
              <React.Fragment key={tx.id}>
                <div className={styles.transactionRow}>
                  <div className={styles.transactionLeft}>
                    <div className={styles.transactionAvatar}>
                      {tx.icon}
                    </div>
                    <div className={styles.transactionInfo}>
                      <span className={styles.transactionTitle}>{tx.title}</span>
                      <div className={styles.transactionMeta}>
                        <span>{tx.categoryName}</span>
                        <span>•</span>
                        <span className={styles.methodTag}>{tx.method}</span>
                        <span>•</span>
                        <span>{tx.date.slice(5)}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.transactionRight}>
                    <span className={tx.kind === 'income' ? styles.incomeAmount : styles.expenseAmount}>
                      {tx.kind === 'income' ? '+' : '-'}{formatCurrency(tx.amount, settings.currency)}
                    </span>
                    <span className={styles.transactionNote}>
                      {('isReversed' in tx && tx.isReversed) || ('isReversal' in tx && tx.isReversal)
                        ? 'Reversed'
                        : tx.isTransfer
                        ? 'Transfer'
                        : tx.kind === 'income'
                        ? 'Credit'
                        : 'Debit'}
                    </span>
                  </div>
                </div>
                {idx < recentTransactions.length - 1 && <div className={styles.divider} />}
              </React.Fragment>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;

import React, { useMemo, useState } from 'react';
import { formatCompactCurrency, formatCurrency } from '../utils/format';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import Input from '../components/ui/Input';
import EditExpenseModal from '../components/EditExpenseModal';
import CategoryDonutChart from '../components/CategoryDonutChart';
import { useExpenses } from '../hooks/useExpenses';
import { useCategories } from '../hooks/useCategories';
import { useSettings } from '../hooks/useSettings';
import { useHydration } from '../hooks/useHydration';
import { useIncome } from '../hooks/useIncome';
import type { Expense } from '../types';
import styles from './Dashboard.module.css';

const Dashboard: React.FC = () => {
  const { expenses, totalSpent, categoryTotals, topCategory } = useExpenses();
  const { categories } = useCategories();
  const { settings } = useSettings();
  const hydrated = useHydration();
  const isLoading = !hydrated;
  const { totalIncome } = useIncome();

  const netCashFlow = totalIncome - totalSpent;

  const navigate = useNavigate();
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const budgetLimit = settings.monthlyBudgetLimit || 0;
  const budgetRemaining = budgetLimit > 0 ? budgetLimit - totalSpent : 0;
  const budgetPercent = budgetLimit > 0 ? Math.min((totalSpent / budgetLimit) * 100, 100) : 0;

  // Filtered recent transactions
  const filteredTransactions = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (!searchQuery.trim()) {
      return sorted.slice(0, 5);
    }
    const searchLower = searchQuery.toLowerCase();
    return sorted
      .filter(exp => {
        const cat = categories.find(c => c.id === exp.categoryId);
        const matchNote = exp.notes?.toLowerCase().includes(searchLower) || false;
        const matchCat = cat?.name.toLowerCase().includes(searchLower) || false;
        return matchNote || matchCat;
      })
      .slice(0, 5);
  }, [expenses, categories, searchQuery]);

  const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  if (isLoading) {
    return (
      <div className={styles.dashboard}>
        <header className={styles.header}>
          <Skeleton variant="line" width={150} height={32} />
          <Skeleton variant="line" width={220} height={16} style={{ marginTop: '8px' }} />
        </header>
        <section className={styles.snapshot}>
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </section>
        <div className={styles.grid}>
          <Skeleton variant="card" height={250} />
          <Skeleton variant="card" height={250} />
        </div>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.emptyWelcomeState}>
          <div className={styles.welcomeIconWrapper}>
            <Sparkles size={48} className={styles.welcomeIcon} />
          </div>
          <h2 className={styles.welcomeTitle}>Welcome to Expense Tracker</h2>
          <p className={styles.welcomeMessage}>Track your expenses, manage bills, and reach your savings goals.</p>
          
          <button 
            className={styles.primaryActionBtn}
            onClick={() => window.dispatchEvent(new Event('openAddExpense'))}
          >
            Add Your First Expense
          </button>
          <p className={styles.secondaryText}>It takes less than 10 seconds to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className={styles.title}>{currentMonthName}</h1>
        <p className={styles.subtitle}>Welcome back! Here's your summary.</p>
      </header>

      {/* Monthly Snapshot */}
      <section className={styles.snapshot}>
        <Card variant="interactive" onClick={() => navigate('/expenses')}>
          <span className={styles.cardLabel}>Spent This Month</span>
          <h2 className={styles.cardValue}>
            {formatCompactCurrency(totalSpent, settings.currency)}
          </h2>
          {budgetLimit > 0 && (
            <div className={styles.budgetWrapper}>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ 
                    width: `${budgetPercent}%`,
                    backgroundColor: budgetPercent >= 100 ? 'var(--danger)' : budgetPercent > 80 ? 'var(--warning)' : 'var(--success)'
                  }} 
                />
              </div>
            </div>
          )}
        </Card>

        <Card variant="interactive" onClick={() => navigate('/settings')}>
          <span className={styles.cardLabel}>Budget Left</span>
          {budgetLimit > 0 ? (
            <h2 className={styles.cardValue} style={{ color: budgetRemaining <= 0 ? 'var(--color-danger)' : 'var(--text-primary)'}}>
              {formatCompactCurrency(budgetRemaining, settings.currency)}
            </h2>
          ) : (
            <div className={styles.emptyBudgetAction}>
              <p className={styles.emptyText}>Set a monthly budget to track your spending.</p>
              <button 
                className={styles.setBudgetBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/settings');
                }}
              >
                Set Budget
              </button>
            </div>
          )}
        </Card>

        {/* Income card */}
        <Card variant="flat">
          <span className={styles.cardLabel}>Income This Month</span>
          <h2 className={styles.cardValue} style={{ color: 'var(--color-success)' }}>
            {formatCompactCurrency(totalIncome, settings.currency)}
          </h2>
        </Card>

        {/* Net Cash Flow card */}
        <Card variant="flat">
          <span className={styles.cardLabel}>Net Cash Flow</span>
          <h2
            className={styles.cardValue}
            style={{ color: netCashFlow >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
          >
            {netCashFlow >= 0 ? '+' : ''}{formatCompactCurrency(netCashFlow, settings.currency)}
          </h2>
        </Card>

        <Card 
          variant={topCategory ? "interactive" : "flat"} 
          onClick={() => topCategory && navigate(`/expenses?categoryId=${topCategory.id}`)}
        >
          <span className={styles.cardLabel}>Biggest Expense</span>
          {topCategory ? (
            <div className={styles.topCat}>
              <div className={styles.topCatIcon}>{topCategory.icon}</div>
              <div className={styles.topCatDetails}>
                <h3 className={styles.topCatName}>{topCategory.name}</h3>
                <span className={styles.topCatAmount}>{formatCompactCurrency(topCategory.amount, settings.currency)}</span>
              </div>
            </div>
          ) : (
            <p className={styles.emptyText}>No expenses yet.</p>
          )}
        </Card>
      </section>

      {/* Main Content Grid */}
      <div className={styles.grid}>
        {/* Chart */}
        {categoryTotals.length > 0 ? (
          <Card variant="flat" className={styles.chartCard}>
            <h3 className={styles.sectionTitle}>Where did your money go?</h3>
            <CategoryDonutChart data={categoryTotals} currency={settings.currency} />
            
            {topCategory && (
              <div className={styles.insight} style={{ marginTop: '16px' }}>
                <p>💡 <strong>Insight:</strong> {topCategory.name} was your biggest expense this month, making up {((topCategory.amount / totalSpent) * 100).toFixed(0)}% of your spending.</p>
              </div>
            )}
          </Card>
        ) : null}

        {/* Recent Transactions */}
        <Card variant="flat">
          <div className={styles.sectionHeader} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            <h3 className={styles.sectionTitle} style={{ margin: 0 }}>Recent Transactions</h3>
            <Input
              placeholder="Search recent notes or categories..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
          
          <div className={styles.transactionList}>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map(exp => {
                const cat = categories.find(c => c.id === exp.categoryId);
                return (
                  <div 
                    key={exp.id} 
                    className={styles.transaction} 
                    onClick={() => setEditExpense(exp)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className={styles.txnIcon}>{cat?.icon || '📦'}</div>
                    <div className={styles.txnDetails}>
                      <span className={styles.txnCat}>{cat?.name || 'Unknown'}</span>
                      <span className={styles.txnDate}>{new Date(exp.date).toLocaleDateString()}</span>
                    </div>
                    <div className={styles.txnAmount}>
                      -{formatCurrency(exp.amount, settings.currency)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.emptyState}>
                <p>No transactions found.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <EditExpenseModal
        isOpen={!!editExpense}
        expense={editExpense}
        onClose={() => setEditExpense(null)}
      />
    </div>
  );
};

export default Dashboard;

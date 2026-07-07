import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import Card from '../components/ui/Card';
import CategoryDonutChart from '../components/CategoryDonutChart';
import { useExpenses } from '../hooks/useExpenses';
import { useCategories } from '../hooks/useCategories';
import { useSettings } from '../hooks/useSettings';
import { useHydration } from '../hooks/useHydration';
import { useIncome } from '../hooks/useIncome';
import { StatCards } from './Dashboard/StatCards';
import { RecentTransactions } from './Dashboard/RecentTransactions';
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
      <StatCards
        totalSpent={totalSpent}
        totalIncome={totalIncome}
        netCashFlow={netCashFlow}
        topCategory={topCategory}
        budgetLimit={budgetLimit}
        budgetPercent={budgetPercent}
        budgetRemaining={budgetRemaining}
        settings={settings}
        navigate={navigate}
      />

      {/* Main Content Grid */}
      <div className={styles.grid}>
        {/* Chart */}
        {categoryTotals.length > 0 && (
          <Card variant="flat" className={styles.chartCard}>
            <h3 className={styles.sectionTitle}>Where did your money go?</h3>
            <CategoryDonutChart data={categoryTotals} currency={settings.currency} />
            
            {topCategory && (
              <div className={styles.insight} style={{ marginTop: '16px' }}>
                <p>💡 <strong>Insight:</strong> {topCategory.name} was your biggest expense this month, making up {((topCategory.amount / totalSpent) * 100).toFixed(0)}% of your spending.</p>
              </div>
            )}
          </Card>
        )}

        {/* Recent Transactions */}
        <RecentTransactions
          filteredTransactions={filteredTransactions}
          categories={categories}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          settings={settings}
        />
      </div>
    </div>
  );
};

export default Dashboard;

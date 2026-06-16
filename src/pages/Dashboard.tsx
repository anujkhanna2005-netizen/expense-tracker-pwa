import React, { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { formatCompactCurrency, formatCurrency } from '../utils/format';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Plus } from 'lucide-react';
import styles from './Dashboard.module.css';

const Dashboard: React.FC = () => {
  const { expenses, categories, settings } = useData();
  const navigate = useNavigate();

  const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  
  // Calculate this month's expenses
  const thisMonthExpenses = useMemo(() => {
    return expenses.filter(exp => exp.date.startsWith(currentMonth));
  }, [expenses, currentMonth]);

  const totalSpent = useMemo(() => {
    return thisMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [thisMonthExpenses]);

  // Aggregate by category
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    thisMonthExpenses.forEach(exp => {
      totals[exp.categoryId] = (totals[exp.categoryId] || 0) + exp.amount;
    });
    
    return Object.entries(totals)
      .map(([id, amount]) => {
        const cat = categories.find(c => c.id === id);
        return {
          id,
          name: cat?.name || 'Unknown',
          amount,
          icon: cat?.icon || '📦'
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [thisMonthExpenses, categories]);

  const topCategory = categoryTotals.length > 0 ? categoryTotals[0] : null;
  const budgetLimit = settings.monthlyBudgetLimit || 0;
  const budgetRemaining = budgetLimit > 0 ? budgetLimit - totalSpent : 0;
  const budgetPercent = budgetLimit > 0 ? Math.min((totalSpent / budgetLimit) * 100, 100) : 0;

  // Chart data
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];
  const chartData = categoryTotals.map((cat, index) => ({
    name: cat.name,
    value: cat.amount,
    fill: COLORS[index % COLORS.length]
  }));

  // Recent transactions
  const recentTransactions = [...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

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
        <div className={styles.card}>
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
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>Budget Left</span>
          {budgetLimit > 0 ? (
            <h2 className={styles.cardValue} style={{ color: budgetRemaining <= 0 ? 'var(--danger)' : 'var(--text-primary)'}}>
              {formatCompactCurrency(budgetRemaining, settings.currency)}
            </h2>
          ) : (
            <div className={styles.emptyBudgetAction}>
              <p className={styles.emptyText}>Set a monthly budget to track your spending.</p>
              <button 
                className={styles.setBudgetBtn}
                onClick={() => navigate('/settings')}
              >
                Set Budget
              </button>
            </div>
          )}
        </div>

        <div className={styles.card}>
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
        </div>
      </section>

      {/* Main Content Grid */}
      <div className={styles.grid}>
        {/* Chart */}
        {chartData.length > 0 && (
          <section className={`${styles.card} ${styles.chartCard}`}>
            <h3 className={styles.sectionTitle}>Where did your money go?</h3>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(Number(value), settings.currency), 'Amount']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-sm)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className={styles.chartLegend}>
              {chartData.slice(0, 4).map((entry, index) => (
                <div key={index} className={styles.legendItem}>
                  <div className={styles.legendColor} style={{ backgroundColor: entry.fill }} />
                  <span className={styles.legendLabel}>{entry.name}</span>
                </div>
              ))}
            </div>
            
            {topCategory && (
              <div className={styles.insight}>
                <p>💡 <strong>Insight:</strong> {topCategory.name} was your biggest expense this month, making up {((topCategory.amount / totalSpent) * 100).toFixed(0)}% of your spending.</p>
              </div>
            )}
          </section>
        )}

        {/* Recent Transactions */}
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Recent Transactions</h3>
          </div>
          
          <div className={styles.transactionList}>
            {recentTransactions.length > 0 ? (
              recentTransactions.map(exp => {
                const cat = categories.find(c => c.id === exp.categoryId);
                return (
                  <div key={exp.id} className={styles.transaction}>
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
                <p>No transactions yet.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;

import React from 'react';
import { formatCompactCurrency } from '../../utils/format';
import Card from '../../components/ui/Card';
import type { Settings } from '../../types';
import styles from '../Dashboard.module.css';

interface StatCardsProps {
  totalSpent: number;
  totalIncome: number;
  netCashFlow: number;
  topCategory: { id: string; name: string; icon?: string; amount: number } | null;
  budgetLimit: number;
  budgetPercent: number;
  budgetRemaining: number;
  settings: Settings;
  navigate: (path: string) => void;
}

export const StatCards: React.FC<StatCardsProps> = ({
  totalSpent,
  totalIncome,
  netCashFlow,
  topCategory,
  budgetLimit,
  budgetPercent,
  budgetRemaining,
  settings,
  navigate
}) => {
  return (
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
  );
};

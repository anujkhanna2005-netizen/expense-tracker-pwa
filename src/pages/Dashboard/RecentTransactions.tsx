import React, { useState } from 'react';
import { formatCurrency } from '../../utils/format';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import EditExpenseModal from '../../components/EditExpenseModal';
import type { Expense, Settings } from '../../types';
import styles from '../Dashboard.module.css';

export interface DashboardTransactionItem {
  kind: 'expense' | 'income';
  id: string;
  date: string;
  amount: number;
  title: string;
  subtitle: string;
  icon: string;
  raw?: Expense;
}

interface RecentTransactionsProps {
  transactions: DashboardTransactionItem[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  settings: Settings;
}

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  transactions,
  searchQuery,
  setSearchQuery,
  settings,
}) => {
  const [editExpense, setEditExpense] = useState<Expense | null>(null);

  return (
    <>
      <Card variant="flat">
        <div className={styles.sectionHeader} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          <h3 className={styles.sectionTitle} style={{ margin: 0 }}>Recent Transactions</h3>
          <Input
            placeholder="Search recent notes, merchants, or categories..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
        
        <div className={styles.transactionList}>
          {transactions.length > 0 ? (
            transactions.map((txn) => {
              const isIncome = txn.kind === 'income';
              return (
                <div 
                  key={`${txn.kind}-${txn.id}`} 
                  className={styles.transaction} 
                  onClick={() => { if (txn.raw) setEditExpense(txn.raw); }}
                  style={{ cursor: txn.raw ? 'pointer' : 'default' }}
                >
                  <div className={styles.txnIcon}>{txn.icon}</div>
                  <div className={styles.txnDetails} style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <span
                      className={styles.txnCat}
                      style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {txn.title}
                    </span>
                    <span
                      className={styles.txnDate}
                      style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={txn.subtitle}
                    >
                      {new Date(txn.date).toLocaleDateString()} • {txn.subtitle}
                    </span>
                  </div>
                  <div
                    className={styles.txnAmount}
                    style={{
                      color: isIncome ? '#10b981' : undefined,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      marginLeft: '8px',
                      textAlign: 'right',
                    }}
                  >
                    {isIncome ? '+' : '-'}{formatCurrency(txn.amount, settings.currency)}
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

      <EditExpenseModal
        isOpen={!!editExpense}
        expense={editExpense}
        onClose={() => setEditExpense(null)}
      />
    </>
  );
};

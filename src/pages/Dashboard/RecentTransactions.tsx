import React, { useState } from 'react';
import { formatCurrency } from '../../utils/format';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import EditExpenseModal from '../../components/EditExpenseModal';
import type { Expense, Category, Settings } from '../../types';
import styles from '../Dashboard.module.css';

interface RecentTransactionsProps {
  filteredTransactions: Expense[];
  categories: Category[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  settings: Settings;
}

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  filteredTransactions,
  categories,
  searchQuery,
  setSearchQuery,
  settings
}) => {
  const [editExpense, setEditExpense] = useState<Expense | null>(null);

  return (
    <>
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

      <EditExpenseModal
        isOpen={!!editExpense}
        expense={editExpense}
        onClose={() => setEditExpense(null)}
      />
    </>
  );
};

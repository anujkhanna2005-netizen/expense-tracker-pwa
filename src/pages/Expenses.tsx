import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { formatCurrency } from '../utils/format';
import { Search, Trash2, Edit2, ReceiptText } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import EditExpenseModal from '../components/EditExpenseModal';
import type { Expense } from '../types';
import styles from './Expenses.module.css';

const Expenses: React.FC = () => {
  const { expenses, categories, settings, deleteExpense } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);

  // Derive unique months from expenses
  const availableMonths = useMemo(() => {
    const months = new Set(expenses.map(e => e.date.slice(0, 7)));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      // Search
      const matchesSearch = exp.notes?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
      const cat = categories.find(c => c.id === exp.categoryId);
      const matchesCatSearch = cat?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
      
      if (searchQuery && !matchesSearch && !matchesCatSearch) return false;
      
      // Filter by Month
      if (selectedMonth !== 'all' && !exp.date.startsWith(selectedMonth)) return false;
      
      // Filter by Category
      if (selectedCategory !== 'all' && exp.categoryId !== selectedCategory) return false;

      return true;
    }).sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [expenses, categories, searchQuery, selectedMonth, selectedCategory, sortOrder]);

  const totalFilteredAmount = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className={styles.expensesContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Expenses</h1>
          <p className={styles.subtitle}>{filteredExpenses.length} transactions • {formatCurrency(totalFilteredAmount, settings.currency)}</p>
        </div>
        
        {/* We reuse the global Plus button from Layout for Quick Add, but we could add one here too if needed */}
      </header>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search notes or category..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.filters}>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className={styles.select}
          >
            <option value="all">All Months</option>
            {availableMonths.map(month => {
              const [year, m] = month.split('-');
              const date = new Date(parseInt(year), parseInt(m) - 1);
              return <option key={month} value={month}>{date.toLocaleString('default', { month: 'short', year: 'numeric' })}</option>;
            })}
          </select>

          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={styles.select}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <select 
            value={sortOrder} 
            onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className={styles.select}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      <div className={styles.expenseList}>
        {filteredExpenses.length > 0 ? (
          filteredExpenses.map(exp => {
            const category = categories.find(c => c.id === exp.categoryId);
            return (
              <div key={exp.id} className={styles.expenseCard}>
                <div className={styles.expenseIcon}>
                  {category?.icon || '📦'}
                </div>
                
                <div className={styles.expenseDetails}>
                  <h3 className={styles.expenseCatName}>{category?.name || 'Unknown'}</h3>
                  <div className={styles.expenseMeta}>
                    <span>{new Date(exp.date).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{exp.paymentMethod}</span>
                  </div>
                  {exp.notes && <p className={styles.expenseNotes}>{exp.notes}</p>}
                </div>

                <div className={styles.expenseActions}>
                  <span className={styles.expenseAmount}>
                    {formatCurrency(exp.amount, settings.currency)}
                  </span>
                  <div className={styles.actionButtons}>
                    <button 
                      className={styles.actionBtn} 
                      aria-label="Edit"
                      onClick={() => setEditExpense(exp)}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      className={`${styles.actionBtn} ${styles.deleteBtn}`} 
                      aria-label="Delete"
                      onClick={() => setDeleteExpenseId(exp.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <ReceiptText size={48} className={styles.emptyIcon} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
            <h3>No expenses recorded yet.</h3>
            <p>Start tracking your spending today.</p>
            <button className={styles.emptyStateBtn} onClick={() => window.dispatchEvent(new Event('openAddExpense'))} style={{ marginTop: '16px', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 'var(--radius-md)', fontWeight: 500, cursor: 'pointer' }}>
              Add Expense
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteExpenseId}
        title="Delete Expense"
        message="Are you sure you want to delete this expense?"
        confirmText="Delete Expense"
        onConfirm={() => {
          if (deleteExpenseId) deleteExpense(deleteExpenseId);
        }}
        onCancel={() => setDeleteExpenseId(null)}
      />

      <EditExpenseModal
        isOpen={!!editExpense}
        expense={editExpense}
        onClose={() => setEditExpense(null)}
      />
    </div>
  );
};

export default Expenses;

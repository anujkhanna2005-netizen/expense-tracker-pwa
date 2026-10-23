import React, { useState, useMemo, useRef } from 'react';
import { formatCurrency } from '../utils/format';
import { Trash2, Edit2, ReceiptText, Upload } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import EditExpenseModal from '../components/EditExpenseModal';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useToast } from '../components/ui/ToastProvider';
import { useExpenses } from '../hooks/useExpenses';
import { useCategories } from '../hooks/useCategories';
import { useSettings } from '../hooks/useSettings';
import type { Expense } from '../types';
import styles from './Expenses.module.css';
import { parseHdfcStatementPdf, parseStatementCsv, type ImportedTransaction } from '../services/statementImportService';

import { useVirtualizer } from '@tanstack/react-virtual';

const Expenses: React.FC = () => {
  const { expenses, deleteExpense, addExpense } = useExpenses();
  const { categories } = useCategories();
  const { settings } = useSettings();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [importRows, setImportRows] = useState<ImportedTransaction[]>([]);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [statementPassword, setStatementPassword] = useState('');
  const pendingDeleteRef = useRef<{ expense: Expense; timer: ReturnType<typeof setTimeout> } | null>(null);
  
  const parentRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = selectedMonth !== 'all' || selectedCategory !== 'all' || sortOrder !== 'newest';

  const clearFilters = () => {
    setSelectedMonth('all');
    setSelectedCategory('all');
    setSortOrder('newest');
  };

  // Derive unique months from expenses
  const monthOptions = useMemo(() => {
    const months = new Set(expenses.map(e => e.date.slice(0, 7)));
    const sorted = Array.from(months).sort((a, b) => b.localeCompare(a));
    const options = [{ value: 'all', label: 'All Months' }];
    sorted.forEach(month => {
      const [year, m] = month.split('-');
      const date = new Date(parseInt(year), parseInt(m) - 1);
      options.push({ value: month, label: date.toLocaleString('default', { month: 'short', year: 'numeric' }) });
    });
    return options;
  }, [expenses]);

  const categoryOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Categories' }];
    categories.forEach(cat => options.push({ value: cat.id, label: cat.name }));
    return options;
  }, [categories]);

  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
  ];

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

  const handleStatementFile = async (file?: File) => {
    setImportError('');
    setImportRows([]);
    setStatementPassword('');
    if (!file) return;
    setStatementFile(file);
    if (file.name.toLowerCase().endsWith('.pdf')) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { setImportError('Choose a CSV or password-protected HDFC statement PDF.'); return; }
    try {
      setImportRows(parseStatementCsv(await file.text(), categories, expenses));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not read this statement.');
    }
  };

  const readPdfStatement = async () => {
    if (!statementFile) return;
    setImportError('');
    try {
      setImportRows(await parseHdfcStatementPdf(statementFile, statementPassword, categories, expenses));
      setStatementPassword('');
    } catch (error) {
      setImportError(error instanceof Error && /password/i.test(error.message) ? 'The password was not accepted. Check it and try again.' : error instanceof Error ? error.message : 'Could not read this statement.');
    }
  };

  const importSelected = () => {
    const selected = importRows.filter((row) => row.selected);
    let imported = 0;
    for (const row of selected) {
      const paymentMethod = /^upi\b/i.test(row.description) ? 'UPI' : 'Bank Transfer';
      if (addExpense({ amount: row.amount, categoryId: row.categoryId, date: row.date, notes: row.description, paymentMethod })) imported += 1;
    }
    setImportRows([]);
    setImporting(false);
    setImportError('');
    toast(`${imported} transaction${imported === 1 ? '' : 's'} imported`, 'success');
  };

  const rowVirtualizer = useVirtualizer({
    count: filteredExpenses.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 85,
    overscan: 5,
  });

  const handleDeleteConfirm = () => {
    if (!deleteExpenseId) return;
    const expenseToDelete = expenses.find(e => e.id === deleteExpenseId);
    if (!expenseToDelete) {
      setDeleteExpenseId(null);
      return;
    }

    // Immediately delete from UI/state
    deleteExpense(deleteExpenseId);
    setDeleteExpenseId(null);

    // Set up undo window
    const timer = setTimeout(() => {
      pendingDeleteRef.current = null;
    }, 5000);

    pendingDeleteRef.current = { expense: expenseToDelete, timer };

    toast(
      `Expense deleted`,
      'info',
      {
        label: 'Undo',
        onClick: () => {
          if (pendingDeleteRef.current) {
            clearTimeout(pendingDeleteRef.current.timer);
            const { expense } = pendingDeleteRef.current;
            addExpense({
              amount: expense.amount,
              categoryId: expense.categoryId,
              date: expense.date,
              notes: expense.notes,
              paymentMethod: expense.paymentMethod,
            });
            pendingDeleteRef.current = null;
          }
        },
      }
    );
  };

  return (
    <div className={styles.expensesContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Expenses</h1>
          <p className={styles.subtitle}>{filteredExpenses.length} transactions • {formatCurrency(totalFilteredAmount, settings.currency)}</p>
        </div>
        <Button variant="secondary" icon={<Upload size={16} />} onClick={() => { setImporting((open) => !open); setImportError(''); setImportRows([]); }}>
          Import statement
        </Button>
      </header>

      {importing && <section className={styles.importPanel} aria-label="Import bank statement">
        <div className={styles.importIntro}>
          <h2>Import a bank statement</h2>
          <p>Choose a CSV export, or a password-protected HDFC statement PDF. The file and password are processed in this browser. Credits are skipped; review each debit and its suggested category before importing.</p>
          <label className={styles.filePicker}>Choose statement<input type="file" accept=".csv,text/csv,.pdf,application/pdf" onChange={(event) => void handleStatementFile(event.target.files?.[0])} /></label>
          {statementFile?.name.toLowerCase().endsWith('.pdf') && <div className={styles.passwordRow}><Input label="PDF password" type="password" autoComplete="off" value={statementPassword} onChange={setStatementPassword} /><Button onClick={() => void readPdfStatement()} disabled={!statementPassword}>Read PDF</Button><small>Password is used locally to open this file and is not saved.</small></div>}
        </div>
        {importError && <p className={styles.importError} role="alert">{importError}</p>}
        {importRows.length > 0 && <>
          <p className={styles.importSummary}>{importRows.filter((row) => row.selected).length} new expense rows selected. Rows already in your tracker are unselected.</p>
          <div className={styles.importTableWrap}><table className={styles.importTable}><thead><tr><th>Import</th><th>Date</th><th>Description</th><th>Amount</th><th>Category</th></tr></thead><tbody>
            {importRows.map((row) => <tr key={row.id}>
              <td><input aria-label={`Import ${row.description}`} type="checkbox" checked={row.selected} onChange={(event) => setImportRows((current) => current.map((item) => item.id === row.id ? { ...item, selected: event.target.checked } : item))} /></td>
              <td>{row.date}</td><td>{row.description}</td><td>{formatCurrency(row.amount, settings.currency)}</td>
              <td><select aria-label={`Category for ${row.description}`} value={row.categoryId} onChange={(event) => setImportRows((current) => current.map((item) => item.id === row.id ? { ...item, categoryId: event.target.value } : item))}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></td>
            </tr>)}
          </tbody></table></div>
          <div className={styles.importActions}><Button variant="ghost" onClick={() => { setImporting(false); setImportRows([]); }}>Cancel</Button><Button onClick={importSelected} disabled={!importRows.some((row) => row.selected)}>Import selected</Button></div>
        </>}
      </section>}

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <Input
            placeholder="Search notes or category..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
        
        <div className={styles.filters}>
          <Select
            value={selectedMonth}
            options={monthOptions}
            onChange={setSelectedMonth}
          />

          <Select
            value={selectedCategory}
            options={categoryOptions}
            onChange={setSelectedCategory}
          />

          <Select
            value={sortOrder}
            options={sortOptions}
            onChange={(v) => setSortOrder(v as 'newest' | 'oldest')}
          />

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div 
        ref={parentRef} 
        className={styles.expenseList} 
        style={{ 
          maxHeight: '650px', 
          overflowY: 'auto', 
          position: 'relative' 
        }}
      >
        {filteredExpenses.length > 0 ? (
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const exp = filteredExpenses[virtualRow.index];
              const category = categories.find(c => c.id === exp.categoryId);
              return (
                <div 
                  key={exp.id} 
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: '12px'
                  }}
                >
                  <div className={styles.expenseCard}>
                    <div className={styles.expenseIcon} aria-hidden="true">
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
                          aria-label="Edit expense"
                          onClick={() => setEditExpense(exp)}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className={`${styles.actionBtn} ${styles.deleteBtn}`} 
                          aria-label="Delete expense"
                          onClick={() => setDeleteExpenseId(exp.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <ReceiptText size={48} className={styles.emptyIcon} />
            <h3>No expenses recorded yet</h3>
            <p>Start tracking your spending by adding your first expense.</p>
            <button className={styles.emptyStateBtn} onClick={() => window.dispatchEvent(new Event('openAddExpense'))}>
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
        onConfirm={handleDeleteConfirm}
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

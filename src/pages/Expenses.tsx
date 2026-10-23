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
import { useIncome } from '../hooks/useIncome';
import { useCategories } from '../hooks/useCategories';
import { useSettings } from '../hooks/useSettings';
import type { Expense } from '../types';
import styles from './Expenses.module.css';
import { parseHdfcStatementPdf, parseStatementCsv, type ImportedTransaction } from '../services/statementImportService';

import { useVirtualizer } from '@tanstack/react-virtual';

/** Infer payment method from the statement description text. */
function inferPaymentMethod(description: string): Expense['paymentMethod'] {
  const text = description.toLowerCase();
  if (/\bneft\b/.test(text)) return 'Bank Transfer';
  if (/\bimps\b/.test(text)) return 'Bank Transfer';
  if (/\brtgs\b/.test(text)) return 'Bank Transfer';
  if (/^upi\b/i.test(description)) return 'UPI';
  if (/\bupi\b/.test(text)) return 'UPI';
  return 'Bank Transfer';
}

const Expenses: React.FC = () => {
  const { expenses, deleteExpense, addExpense } = useExpenses();
  const { incomes, deleteIncome } = useIncome();
  const { categories } = useCategories();
  const { settings } = useSettings();
  const { toast } = useToast();

  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; kind: 'expense' | 'income'; name: string } | null>(null);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [importRows, setImportRows] = useState<ImportedTransaction[]>([]);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [statementPassword, setStatementPassword] = useState('');
  const pendingDeleteRef = useRef<{ expense: Expense; timer: ReturnType<typeof setTimeout> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const parentRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = selectedMonth !== 'all' || selectedCategory !== 'all' || sortOrder !== 'newest' || typeFilter !== 'all';

  const clearFilters = () => {
    setSelectedMonth('all');
    setSelectedCategory('all');
    setSortOrder('newest');
    setTypeFilter('all');
  };

  // Derive unique months from both expenses and incomes
  const monthOptions = useMemo(() => {
    const months = new Set([
      ...expenses.map((e) => e.date.slice(0, 7)),
      ...incomes.map((i) => i.date.slice(0, 7)),
    ]);
    const sorted = Array.from(months).sort((a, b) => b.localeCompare(a));
    const options = [{ value: 'all', label: 'All Months' }];
    sorted.forEach((month) => {
      const [year, m] = month.split('-');
      const date = new Date(parseInt(year), parseInt(m) - 1);
      options.push({ value: month, label: date.toLocaleString('default', { month: 'short', year: 'numeric' }) });
    });
    return options;
  }, [expenses, incomes]);

  const categoryOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Categories' }];
    categories.forEach((cat) => options.push({ value: cat.id, label: cat.name }));
    return options;
  }, [categories]);

  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
  ];

  const combinedTransactions = useMemo(() => {
    const list: Array<{
      id: string;
      kind: 'expense' | 'income';
      date: string;
      amount: number;
      title: string;
      subtitle: string;
      icon: string;
      notes?: string;
      categoryId?: string;
      rawExpense?: Expense;
    }> = [];

    if (typeFilter === 'all' || typeFilter === 'expense') {
      expenses.forEach((exp) => {
        const cat = categories.find((c) => c.id === exp.categoryId);
        list.push({
          id: exp.id,
          kind: 'expense',
          date: exp.date,
          amount: exp.amount,
          title: cat?.name || 'Expense',
          subtitle: exp.paymentMethod || 'Expense',
          icon: cat?.icon || '📦',
          notes: exp.notes,
          categoryId: exp.categoryId,
          rawExpense: exp,
        });
      });
    }

    if (typeFilter === 'all' || typeFilter === 'income') {
      incomes.forEach((inc) => {
        list.push({
          id: inc.id,
          kind: 'income',
          date: inc.date,
          amount: inc.amount,
          title: inc.source || 'Income',
          subtitle: 'Received via UPI/Bank',
          icon: '💰',
          notes: inc.notes,
        });
      });
    }

    return list;
  }, [expenses, incomes, categories, typeFilter]);

  const filteredTransactions = useMemo(() => {
    return combinedTransactions.filter((item) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = item.notes?.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query);
      if (searchQuery && !matchesSearch) return false;

      if (selectedMonth !== 'all' && !item.date.startsWith(selectedMonth)) return false;
      if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) return false;

      return true;
    }).sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [combinedTransactions, searchQuery, selectedMonth, selectedCategory, sortOrder]);

  const totalFilteredSpent = filteredTransactions
    .filter((t) => t.kind === 'expense')
    .reduce((sum, exp) => sum + exp.amount, 0);

  const totalFilteredIncome = filteredTransactions
    .filter((t) => t.kind === 'income')
    .reduce((sum, inc) => sum + inc.amount, 0);

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
      const paymentMethod = inferPaymentMethod(row.description);
      if (addExpense({ amount: row.amount, categoryId: row.categoryId, date: row.date, notes: row.description, paymentMethod })) imported += 1;
    }
    setImportRows([]);
    setImporting(false);
    setImportError('');
    setStatementFile(null);
    // Reset the file input so the same file can be chosen again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast(`${imported} transaction${imported === 1 ? '' : 's'} imported`, 'success');
  };

  const toggleAllSelected = (checked: boolean) =>
    setImportRows((current) => current.map((row) => ({ ...row, selected: checked })));

  const rowVirtualizer = useVirtualizer({
    count: filteredTransactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 85,
    overscan: 5,
  });

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;

    if (deleteTarget.kind === 'income') {
      deleteIncome(deleteTarget.id);
      setDeleteTarget(null);
      toast('Income transaction deleted', 'info');
      return;
    }

    const expenseToDelete = expenses.find((e) => e.id === deleteTarget.id);
    if (!expenseToDelete) {
      setDeleteTarget(null);
      return;
    }

    deleteExpense(deleteTarget.id);
    setDeleteTarget(null);

    const timer = setTimeout(() => {
      pendingDeleteRef.current = null;
    }, 5000);

    pendingDeleteRef.current = { expense: expenseToDelete, timer };

    toast(`Expense deleted`, 'info', {
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
    });
  };

  return (
    <div className={styles.expensesContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Transactions</h1>
          <p className={styles.subtitle}>
            {filteredTransactions.length} transaction{filteredTransactions.length === 1 ? '' : 's'}
            {totalFilteredSpent > 0 && <> • Spent: {formatCurrency(totalFilteredSpent, settings.currency)}</>}
            {totalFilteredIncome > 0 && <> • Received: {formatCurrency(totalFilteredIncome, settings.currency)}</>}
          </p>
        </div>
        <Button
          variant="secondary"
          icon={<Upload size={16} />}
          onClick={() => {
            setImporting((open) => !open);
            setImportError('');
            setImportRows([]);
          }}
        >
          Import statement
        </Button>
      </header>

      {importing && (
        <section className={styles.importPanel} aria-label="Import bank statement">
          <div className={styles.importIntro}>
            <h2>Import a bank statement</h2>
            <p>Choose a CSV export or a password-protected HDFC statement PDF. Files are parsed in this browser. Credits, refunds, and balance-only lines are skipped automatically. Review each debit and its suggested category before importing.</p>
            <label className={styles.filePicker}>
              Choose statement
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,.pdf,application/pdf"
                onChange={(event) => void handleStatementFile(event.target.files?.[0])}
              />
            </label>
            {statementFile?.name.toLowerCase().endsWith('.pdf') && (
              <div className={styles.passwordRow}>
                <Input label="PDF password" type="password" autoComplete="off" value={statementPassword} onChange={setStatementPassword} />
                <Button onClick={() => void readPdfStatement()} disabled={!statementPassword}>Read PDF</Button>
                <small>Password is used locally to open this file and is not saved.</small>
              </div>
            )}
          </div>
          {importError && <p className={styles.importError} role="alert">{importError}</p>}
          {importRows.length > 0 && (() => {
            const selectedRows = importRows.filter((row) => row.selected);
            const selectedTotal = selectedRows.reduce((sum, row) => sum + row.amount, 0);
            const allSelected = importRows.every((row) => row.selected);
            return (
              <>
                <p className={styles.importSummary}>
                  {selectedRows.length} of {importRows.length} rows selected
                  {selectedRows.length > 0 && <> &nbsp;·&nbsp; <strong>{formatCurrency(selectedTotal, settings.currency)}</strong> total</>}
                  {' '}&mdash; rows already in your tracker are unselected.
                </p>
                <div className={styles.importTableWrap}>
                  <table className={styles.importTable}>
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            aria-label={allSelected ? 'Deselect all' : 'Select all'}
                            checked={allSelected}
                            onChange={(e) => toggleAllSelected(e.target.checked)}
                          />
                        </th>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <input
                              aria-label={`Import ${row.description}`}
                              type="checkbox"
                              checked={row.selected}
                              onChange={(event) => setImportRows((current) =>
                                current.map((item) => item.id === row.id ? { ...item, selected: event.target.checked } : item)
                              )}
                            />
                          </td>
                          <td>{row.date}</td>
                          <td>{row.description}</td>
                          <td>{formatCurrency(row.amount, settings.currency)}</td>
                          <td>
                            <select
                              aria-label={`Category for ${row.description}`}
                              value={row.categoryId}
                              onChange={(event) => setImportRows((current) =>
                                current.map((item) => item.id === row.id ? { ...item, categoryId: event.target.value } : item)
                              )}
                            >
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={styles.importActions}>
                  <Button variant="ghost" onClick={() => { setImporting(false); setImportRows([]); }}>Cancel</Button>
                  <Button onClick={importSelected} disabled={selectedRows.length === 0}>
                    Import {selectedRows.length > 0 ? `${selectedRows.length} rows` : 'selected'}
                  </Button>
                </div>
              </>
            );
          })()}
        </section>
      )}

      <div className={styles.controls}>
        <div className={styles.typeTabs} role="tablist" aria-label="Transaction type filter">
          <button
            type="button"
            className={`${styles.typeTabBtn} ${typeFilter === 'all' ? styles.typeTabBtnActive : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`${styles.typeTabBtn} ${typeFilter === 'expense' ? styles.typeTabBtnActive : ''}`}
            onClick={() => setTypeFilter('expense')}
          >
            Expenses (Debits)
          </button>
          <button
            type="button"
            className={`${styles.typeTabBtn} ${typeFilter === 'income' ? styles.typeTabBtnActive : ''}`}
            onClick={() => setTypeFilter('income')}
          >
            Income (Credits)
          </button>
        </div>

        <div className={styles.searchBox}>
          <Input
            placeholder="Search notes, merchants, or categories..."
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

          {typeFilter !== 'income' && (
            <Select
              value={selectedCategory}
              options={categoryOptions}
              onChange={setSelectedCategory}
            />
          )}

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
        {filteredTransactions.length > 0 ? (
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = filteredTransactions[virtualRow.index];
              const isIncome = item.kind === 'income';
              return (
                <div 
                  key={`${item.kind}-${item.id}`} 
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
                      {item.icon}
                    </div>
                    
                    <div className={styles.expenseDetails}>
                      <h3 className={styles.expenseCatName}>{item.title}</h3>
                      <div className={styles.expenseMeta}>
                        <span>{new Date(item.date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{item.subtitle}</span>
                      </div>
                      {item.notes && <p className={styles.expenseNotes}>{item.notes}</p>}
                    </div>

                    <div className={styles.expenseActions}>
                      <span
                        className={styles.expenseAmount}
                        style={{ color: isIncome ? 'var(--color-success, #10b981)' : 'var(--text-primary)' }}
                      >
                        {isIncome ? '+' : '-'}{formatCurrency(item.amount, settings.currency)}
                      </span>
                      <div className={styles.actionButtons}>
                        {!isIncome && item.rawExpense && (
                          <button 
                            className={styles.actionBtn} 
                            aria-label="Edit expense"
                            onClick={() => setEditExpense(item.rawExpense!)}
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        <button 
                          className={`${styles.actionBtn} ${styles.deleteBtn}`} 
                          aria-label={`Delete ${item.title}`}
                          onClick={() => setDeleteTarget({ id: item.id, kind: item.kind, name: item.title })}
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
            <h3>
              {typeFilter === 'income'
                ? 'No incoming payments recorded yet'
                : typeFilter === 'expense'
                ? 'No expenses recorded yet'
                : 'No transactions recorded yet'}
            </h3>
            <p>
              {typeFilter === 'income'
                ? 'Incoming UPI payments and bank credits from notifications will appear here automatically.'
                : 'Start tracking your spending by adding an expense or capturing UPI notifications.'}
            </p>
            {typeFilter !== 'income' && (
              <button className={styles.emptyStateBtn} onClick={() => window.dispatchEvent(new Event('openAddExpense'))}>
                Add Expense
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title={deleteTarget?.kind === 'income' ? 'Delete Income' : 'Delete Expense'}
        message={`Are you sure you want to delete this ${deleteTarget?.kind === 'income' ? 'income entry' : 'expense'}?`}
        confirmText="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
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

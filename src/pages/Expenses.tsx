import React, { useState, useMemo, useRef } from 'react';
import { formatCurrency } from '../utils/format';
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
import { CapturedReviewBanner } from '../components/CapturedReviewBanner';

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

function formatDateGroupTitle(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const part = dateStr.slice(0, 10);

  const d = new Date(part + 'T00:00:00');
  const dayMonth = d.toLocaleDateString('default', { day: 'numeric', month: 'long' });

  if (part === today) return `Today, ${dayMonth}`;
  if (part === yesterday) return `Yesterday, ${dayMonth}`;
  return d.toLocaleDateString('default', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getCategoryColor(categoryName: string, kind: 'expense' | 'income') {
  if (kind === 'income') {
    return { bg: 'rgba(5, 150, 105, 0.12)', text: '#059669', icon: 'payments' };
  }
  const name = categoryName.toLowerCase();
  if (name.includes('food') || name.includes('dining') || name.includes('restaurant') || name.includes('cafe')) {
    return { bg: 'rgba(217, 119, 6, 0.12)', text: '#D97706', icon: 'restaurant' };
  }
  if (name.includes('shop') || name.includes('cloth') || name.includes('store')) {
    return { bg: 'rgba(124, 58, 237, 0.12)', text: '#7C3AED', icon: 'shopping_bag' };
  }
  if (name.includes('grocer') || name.includes('mart') || name.includes('super')) {
    return { bg: 'rgba(15, 118, 110, 0.12)', text: '#0F766E', icon: 'shopping_cart' };
  }
  if (name.includes('fuel') || name.includes('petrol') || name.includes('travel') || name.includes('cab') || name.includes('auto')) {
    return { bg: 'rgba(234, 88, 12, 0.12)', text: '#EA580C', icon: 'local_gas_station' };
  }
  if (name.includes('bill') || name.includes('util') || name.includes('electric') || name.includes('recharge')) {
    return { bg: 'rgba(37, 99, 235, 0.12)', text: '#2563EB', icon: 'receipt_long' };
  }
  if (name.includes('health') || name.includes('med') || name.includes('doctor')) {
    return { bg: 'rgba(219, 39, 119, 0.12)', text: '#DB2777', icon: 'medical_services' };
  }
  return { bg: 'rgba(15, 118, 110, 0.1)', text: '#0F766E', icon: 'category' };
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; kind: 'expense' | 'income'; name: string } | null>(null);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [importRows, setImportRows] = useState<ImportedTransaction[]>([]);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [statementPassword, setStatementPassword] = useState('');
  const pendingDeleteRef = useRef<{ expense: Expense; timer: ReturnType<typeof setTimeout> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasActiveFilters = selectedMonth !== 'all' || selectedCategory !== 'all' || sortOrder !== 'newest' || typeFilter !== 'all' || searchQuery.length > 0;

  const clearFilters = () => {
    setSelectedMonth('all');
    setSelectedCategory('all');
    setSortOrder('newest');
    setTypeFilter('all');
    setSearchQuery('');
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

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const isThisMonthActive = selectedMonth === currentMonthKey;

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
      paymentMethod?: string;
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
          paymentMethod: exp.paymentMethod,
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
          subtitle: 'Received via UPI / Bank',
          icon: '💰',
          notes: inc.notes,
          paymentMethod: 'Bank Credit',
        });
      });
    }

    return list;
  }, [expenses, incomes, categories, typeFilter]);

  const filteredTransactions = useMemo(() => {
    return combinedTransactions.filter((item) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        item.notes?.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query) ||
        (item.paymentMethod && item.paymentMethod.toLowerCase().includes(query));
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

  // Group filtered transactions by date for the grouped ledger feed
  const groupedTransactions = useMemo(() => {
    const groups: { [dateStr: string]: typeof filteredTransactions } = {};
    for (const tx of filteredTransactions) {
      const dateKey = tx.date.slice(0, 10);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(tx);
    }
    return Object.entries(groups).map(([dateKey, items]) => {
      const count = items.length;
      const spent = items.filter((t) => t.kind === 'expense').reduce((acc, t) => acc + t.amount, 0);
      const income = items.filter((t) => t.kind === 'income').reduce((acc, t) => acc + t.amount, 0);
      return {
        dateKey,
        title: formatDateGroupTitle(dateKey),
        summary:
          spent > 0 && income > 0
            ? `${count} items • -${formatCurrency(spent, settings.currency)} / +${formatCurrency(income, settings.currency)}`
            : spent > 0
            ? `${count} expense${count === 1 ? '' : 's'} • ${formatCurrency(spent, settings.currency)}`
            : `${count} income${count === 1 ? '' : 's'} • ${formatCurrency(income, settings.currency)}`,
        items,
      };
    });
  }, [filteredTransactions, settings.currency]);

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
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('Choose a CSV or password-protected HDFC statement PDF.');
      return;
    }
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
      setImportError(
        error instanceof Error && /password/i.test(error.message)
          ? 'The password was not accepted. Check it and try again.'
          : error instanceof Error
          ? error.message
          : 'Could not read this statement.'
      );
    }
  };

  const importSelected = () => {
    const selected = importRows.filter((row) => row.selected);
    let imported = 0;
    for (const row of selected) {
      const paymentMethod = inferPaymentMethod(row.description);
      if (addExpense({ amount: row.amount, categoryId: row.categoryId, date: row.date, notes: row.description, paymentMethod })) {
        imported += 1;
      }
    }
    setImportRows([]);
    setImporting(false);
    setImportError('');
    setStatementFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast(`${imported} transaction${imported === 1 ? '' : 's'} imported`, 'success');
  };

  const toggleAllSelected = (checked: boolean) =>
    setImportRows((current) => current.map((row) => ({ ...row, selected: checked })));

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

    toast('Expense deleted', 'info', {
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

  const displaySnapshotTitle = useMemo(() => {
    if (selectedMonth === 'all') return 'All-Time Financial Snapshot';
    const [year, m] = selectedMonth.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1);
    return `${date.toLocaleString('default', { month: 'long', year: 'numeric' })} Snapshot`;
  }, [selectedMonth]);

  return (
    <div className={styles.expensesContainer}>
      {/* Top Header Row */}
      <div className={styles.topBar}>
        <div className={styles.titleArea}>
          <h1 className={styles.pageTitle}>Transactions</h1>
          <p className={styles.pageSubtitle}>
            {filteredTransactions.length} transaction{filteredTransactions.length === 1 ? '' : 's'} logged
          </p>
        </div>
        <button
          type="button"
          className={styles.importBtn}
          onClick={() => {
            setImporting((open) => !open);
            setImportError('');
            setImportRows([]);
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            upload_file
          </span>
          <span>Import Statement</span>
        </button>
      </div>

      <CapturedReviewBanner />

      {/* Statement Import Panel */}
      {importing && (
        <section className={styles.importPanel} aria-label="Import bank statement">
          <div className={styles.importIntro}>
            <h2>Import Bank Statement</h2>
            <p>
              Choose a CSV export or password-protected HDFC statement PDF. All files are parsed locally on your device for complete privacy.
            </p>
            <label className={styles.filePicker}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                attach_file
              </span>
              <span>Choose File (CSV or PDF)</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,.pdf,application/pdf"
                onChange={(event) => void handleStatementFile(event.target.files?.[0])}
              />
            </label>
            {statementFile?.name.toLowerCase().endsWith('.pdf') && (
              <div className={styles.passwordRow}>
                <Input
                  label="PDF Password"
                  type="password"
                  autoComplete="off"
                  value={statementPassword}
                  onChange={setStatementPassword}
                />
                <Button onClick={() => void readPdfStatement()} disabled={!statementPassword}>
                  Read PDF
                </Button>
                <small>Password is processed securely in memory and never stored.</small>
              </div>
            )}
          </div>
          {importError && (
            <p className={styles.importError} role="alert">
              {importError}
            </p>
          )}
          {importRows.length > 0 && (() => {
            const selectedRows = importRows.filter((row) => row.selected);
            const selectedTotal = selectedRows.reduce((sum, row) => sum + row.amount, 0);
            const allSelected = importRows.every((row) => row.selected);
            return (
              <>
                <p className={styles.importSummary}>
                  {selectedRows.length} of {importRows.length} rows selected
                  {selectedRows.length > 0 && (
                    <>
                      {' '}
                      &nbsp;·&nbsp; <strong>{formatCurrency(selectedTotal, settings.currency)}</strong> total
                    </>
                  )}
                  {' '}— rows already in your tracker are unselected.
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
                              onChange={(event) =>
                                setImportRows((current) =>
                                  current.map((item) =>
                                    item.id === row.id ? { ...item, selected: event.target.checked } : item
                                  )
                                )
                              }
                            />
                          </td>
                          <td>{row.date}</td>
                          <td>{row.description}</td>
                          <td>{formatCurrency(row.amount, settings.currency)}</td>
                          <td>
                            <select
                              aria-label={`Category for ${row.description}`}
                              value={row.categoryId}
                              onChange={(event) =>
                                setImportRows((current) =>
                                  current.map((item) =>
                                    item.id === row.id ? { ...item, categoryId: event.target.value } : item
                                  )
                                )
                              }
                            >
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={styles.importActions}>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setImporting(false);
                      setImportRows([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={importSelected} disabled={selectedRows.length === 0}>
                    Import {selectedRows.length > 0 ? `${selectedRows.length} rows` : 'selected'}
                  </Button>
                </div>
              </>
            );
          })()}
        </section>
      )}

      {/* Interactive Controls Bar: Search & Quick Filter Pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Floating Search Bar */}
        <div className={styles.searchBar}>
          <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
          <input
            className={styles.searchInput}
            placeholder="Search by merchant, note, or payment method..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                close
              </span>
            </button>
          )}
          <button
            type="button"
            className={`${styles.tuneBtn} ${showAdvancedFilters ? styles.tuneBtnActive : ''}`}
            onClick={() => setShowAdvancedFilters((v) => !v)}
            aria-label="Toggle advanced filters"
            title="Filter options"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              tune
            </span>
          </button>
        </div>

        {/* Filter Chips Carousel */}
        <div className={styles.filterCarousel}>
          <button
            type="button"
            className={`${styles.filterChip} ${typeFilter === 'all' ? styles.filterChipActive : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`${styles.filterChip} ${typeFilter === 'expense' ? styles.filterChipActive : ''}`}
            onClick={() => setTypeFilter('expense')}
          >
            Expenses (-)
          </button>
          <button
            type="button"
            className={`${styles.filterChip} ${typeFilter === 'income' ? styles.filterChipActive : ''}`}
            onClick={() => setTypeFilter('income')}
          >
            Income (+)
          </button>
          <button
            type="button"
            className={`${styles.filterChip} ${isThisMonthActive ? styles.filterChipActive : ''}`}
            onClick={() => setSelectedMonth(isThisMonthActive ? 'all' : currentMonthKey)}
          >
            <span>This Month</span>
            {isThisMonthActive && (
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                check
              </span>
            )}
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              className={styles.filterChip}
              onClick={clearFilters}
              style={{ color: 'var(--color-status-expense)', borderColor: 'rgba(220, 38, 38, 0.2)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                restart_alt
              </span>
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Expandable Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className={styles.filterDrawer}>
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
          </div>
        )}
      </div>

      {/* Ambient Financial Summary Ticker Banner */}
      <div className={styles.tickerBanner}>
        <div className={styles.tickerGlow} />
        <div className={styles.tickerHeader}>
          <div className={styles.tickerTitleGroup}>
            <span className={`material-symbols-outlined ${styles.tickerShield}`}>verified</span>
            <span className={styles.tickerTitle}>{displaySnapshotTitle}</span>
          </div>
          <span className={styles.tickerBadge}>
            {filteredTransactions.length} Transaction{filteredTransactions.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className={styles.tickerGrid}>
          <div className={styles.tickerStatCard}>
            <div className={styles.tickerStatLabel}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                arrow_downward
              </span>
              <span>Total Spent</span>
            </div>
            <div className={styles.tickerStatValue}>
              {formatCurrency(totalFilteredSpent, settings.currency)}
            </div>
          </div>
          <div className={styles.tickerStatCard}>
            <div className={styles.tickerStatLabel}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                arrow_upward
              </span>
              <span>Total Income</span>
            </div>
            <div className={`${styles.tickerStatValue} ${styles.tickerStatValueMint}`}>
              {formatCurrency(totalFilteredIncome, settings.currency)}
            </div>
          </div>
        </div>
      </div>

      {/* Grouped Transaction Log Feed */}
      <div className={styles.feedContainer}>
        {groupedTransactions.length > 0 ? (
          groupedTransactions.map((group) => (
            <div key={group.dateKey} className={styles.dateGroup}>
              {/* Date Group Header */}
              <div className={styles.groupHeader}>
                <div className={styles.groupTitleArea}>
                  <span className={styles.groupDot} />
                  <span className={styles.groupTitle}>{group.title}</span>
                </div>
                <span className={styles.groupSummary}>{group.summary}</span>
              </div>

              {/* Transactions in this Group */}
              <div className={styles.cardList}>
                {group.items.map((item) => {
                  const isIncome = item.kind === 'income';
                  const catTheme = getCategoryColor(item.title, item.kind);

                  return (
                    <div key={`${item.kind}-${item.id}`} className={styles.txCard}>
                      <div className={styles.txLeft}>
                        {/* Jewel Icon Box */}
                        <div
                          className={styles.txIconBox}
                          style={{ background: catTheme.bg, color: catTheme.text }}
                          aria-hidden="true"
                        >
                          <span className="material-symbols-outlined">{catTheme.icon}</span>
                        </div>

                        <div className={styles.txInfo}>
                          <h3 className={styles.txTitle}>{item.notes || item.title}</h3>
                          <div className={styles.txMetaRow}>
                            <span style={{ fontWeight: 600, color: 'var(--ink-primary)' }}>{item.title}</span>
                            <span>•</span>
                            <span>{item.subtitle}</span>
                          </div>
                          {item.paymentMethod && (
                            <div className={styles.txPillsRow}>
                              <span className={styles.tagPill}>{item.paymentMethod}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={styles.txRight}>
                        <span
                          className={`${styles.txAmount} ${
                            isIncome ? styles.amountIncome : styles.amountExpense
                          }`}
                        >
                          {isIncome ? '+' : '-'}{formatCurrency(item.amount, settings.currency)}
                        </span>
                        <span
                          className={`${styles.directionBadge} ${
                            isIncome ? styles.directionCredit : styles.directionDebit
                          }`}
                        >
                          {isIncome ? 'Credit' : 'Debit'}
                        </span>
                        <div className={styles.actionRow}>
                          {!isIncome && item.rawExpense && (
                            <button
                              type="button"
                              className={styles.actionIconBtn}
                              aria-label="Edit expense"
                              onClick={() => setEditExpense(item.rawExpense!)}
                              title="Edit"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                edit
                              </span>
                            </button>
                          )}
                          <button
                            type="button"
                            className={`${styles.actionIconBtn} ${styles.actionDeleteBtn}`}
                            aria-label={`Delete ${item.title}`}
                            onClick={() => setDeleteTarget({ id: item.id, kind: item.kind, name: item.title })}
                            title="Delete"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                              delete
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className={styles.emptyState}>
            <span className={`material-symbols-outlined ${styles.emptyIcon}`}>receipt_long</span>
            <h3>
              {typeFilter === 'income'
                ? 'No incoming payments found'
                : typeFilter === 'expense'
                ? 'No expenses recorded yet'
                : 'No transactions found'}
            </h3>
            <p>
              {typeFilter === 'income'
                ? 'Incoming UPI payments and bank credits from notifications will appear here automatically.'
                : 'Start tracking by tapping the + button below or capturing notifications from your bank.'}
            </p>
            {typeFilter !== 'income' && (
              <button
                type="button"
                className={styles.emptyStateBtn}
                onClick={() => window.dispatchEvent(new Event('openAddExpense'))}
              >
                + Add Transaction
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title={deleteTarget?.kind === 'income' ? 'Delete Income' : 'Delete Expense'}
        message={`Are you sure you want to delete this ${
          deleteTarget?.kind === 'income' ? 'income entry' : 'expense'
        }?`}
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

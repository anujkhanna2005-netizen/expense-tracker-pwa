import React, { useState, useEffect } from 'react';
import { INCOME_SOURCES } from '../types/income';
import { useIncome } from '../hooks/useIncome';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../components/ui/ToastProvider';
import Modal from './ui/Modal';
import styles from './AddIncomeModal.module.css';

interface AddIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SOURCE_OPTIONS = INCOME_SOURCES.map((s) => ({ value: s, label: s }));

const AddIncomeModal: React.FC<AddIncomeModalProps> = ({ isOpen, onClose }) => {
  const { addIncome } = useIncome();
  const { settings } = useSettings();
  const { toast } = useToast();

  const [amount, setAmount] = useState('');
  const [source, setSource] = useState<string>(INCOME_SOURCES[0]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'monthly'>('monthly');

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setSource(INCOME_SOURCES[0]);
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setIsRecurring(false);
      setRecurringFrequency('monthly');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || !source || !date) return;

    const success = addIncome({
      amount: Number(amount),
      source,
      date,
      notes: notes.trim() || undefined,
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : undefined,
    });

    if (success) {
      toast('Income recorded!', 'success');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Income" variant="sheet" accentColor="income">
      <form onSubmit={handleSave} className={styles.form}>
          {/* Big amount input */}
          <div className={styles.amountInputWrapper}>
            <span className={styles.currencySymbol}>{settings.currency}</span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={styles.amountInput}
              placeholder="0.00"
              autoFocus
              required
              min="0.01"
              inputMode="decimal"
            />
          </div>

          {/* Source */}
          <div className={styles.field}>
            <label htmlFor="income-source">Source</label>
            <select
              id="income-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className={styles.select}
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className={styles.field}>
            <label htmlFor="income-date">Date</label>
            <input
              id="income-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={styles.input}
              required
            />
          </div>

          {/* Notes */}
          <div className={styles.field}>
            <label htmlFor="income-notes">Notes (Optional)</label>
            <input
              id="income-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={styles.input}
              placeholder="e.g. July salary, client payment..."
            />
          </div>

          {/* Recurring toggle */}
          <div className={styles.recurringRow}>
            <label className={styles.recurringLabel}>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className={styles.recurringCheckbox}
              />
              <span>Recurring income</span>
            </label>
            {isRecurring && (
              <select
                value={recurringFrequency}
                onChange={(e) => setRecurringFrequency(e.target.value as 'weekly' | 'monthly')}
                className={styles.select}
                style={{ maxWidth: '160px' }}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            )}
          </div>

          <button type="submit" className={styles.saveBtn}>
            Save Income
          </button>
        </form>
    </Modal>
  );
};

export default AddIncomeModal;

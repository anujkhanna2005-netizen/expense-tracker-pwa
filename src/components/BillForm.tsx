import React, { useState, useEffect, useMemo } from 'react';
import { useBills } from '../hooks/useBills';
import { useCategories } from '../hooks/useCategories';
import Select from './ui/Select';
import Button from './ui/Button';
import styles from './QuickAddExpense.module.css';

interface BillFormProps {
  billId: string | null;
  onClose: () => void;
}

export const BillForm: React.FC<BillFormProps> = ({ billId, onClose }) => {
  const { bills, addBill, updateBill } = useBills();
  const { categories } = useCategories();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'monthly'>('monthly');

  useEffect(() => {
    if (billId) {
      const bill = bills.find(b => b.id === billId);
      if (bill) {
        setName(bill.name);
        setAmount(bill.amount.toString());
        setDueDate(bill.dueDate);
        setCategoryId(bill.categoryId);
        setIsRecurring(bill.isRecurring ?? false);
        setRecurringFrequency(bill.recurringFrequency ?? 'monthly');
      }
    } else {
      setName('');
      setAmount('');
      setDueDate('');
      setCategoryId('');
      setIsRecurring(false);
      setRecurringFrequency('monthly');
    }
  }, [billId, bills]);

  const categoryOptions = useMemo(() => {
    const options = [{ value: '', label: 'Select Category' }];
    categories.forEach(cat => options.push({ value: cat.id, label: cat.name }));
    return options;
  }, [categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount || !dueDate || !categoryId) return;

    if (billId) {
      updateBill(billId, {
        name,
        amount: Number(amount),
        dueDate,
        categoryId,
        isRecurring,
        recurringFrequency: isRecurring ? recurringFrequency : undefined,
      });
    } else {
      addBill({
        name,
        amount: Number(amount),
        dueDate,
        isPaid: false,
        reminderEnabled: false,
        categoryId,
        isRecurring,
        recurringFrequency: isRecurring ? recurringFrequency : undefined,
      });
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} style={{ padding: 0 }}>
      <div className={styles.field}>
        <label htmlFor="bill-name">Bill Name</label>
        <input 
          id="bill-name"
          type="text" 
          placeholder="e.g. Rent, Netflix..." 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          className={styles.input} 
          required 
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="bill-amount">Amount</label>
        <input 
          id="bill-amount"
          type="number" 
          placeholder="0.00" 
          value={amount} 
          onChange={(e) => setAmount(e.target.value)} 
          className={styles.input} 
          required 
          min="0.01" 
          step="0.01" 
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="bill-due">Due Date</label>
        <input 
          id="bill-due"
          type="date" 
          value={dueDate} 
          onChange={(e) => setDueDate(e.target.value)} 
          className={styles.input} 
          required 
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="bill-category">Category</label>
        <Select
          value={categoryId}
          options={categoryOptions}
          onChange={setCategoryId}
        />
      </div>

      {/* Recurring toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
          />
          <span>Auto-generate expense each period</span>
        </label>
        {isRecurring && (
          <Select
            value={recurringFrequency}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'weekly', label: 'Weekly' },
            ]}
            onChange={(v) => setRecurringFrequency(v as 'weekly' | 'monthly')}
          />
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          Save Bill
        </Button>
      </div>
    </form>
  );
};

export default BillForm;

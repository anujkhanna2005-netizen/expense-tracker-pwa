import React, { useState, useEffect, useRef } from 'react';
import { PAYMENT_METHODS } from '../types';
import type { PaymentMethod } from '../types';
import { useExpenses } from '../hooks/useExpenses';
import { useCategories } from '../hooks/useCategories';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../components/ui/ToastProvider';
import Modal from './ui/Modal';
import styles from './QuickAddExpense.module.css';

interface QuickAddExpenseProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuickAddExpense: React.FC<QuickAddExpenseProps> = ({ isOpen, onClose }) => {
  const { addExpense } = useExpenses();
  const { categories } = useCategories();
  const { settings } = useSettings();
  const { toast } = useToast();
  
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [notes, setNotes] = useState('');
  const hasInitializedCategory = useRef(false);

  useEffect(() => {
    if (isOpen) {
      const lastPayment = localStorage.getItem('lastPaymentMethod') as PaymentMethod;
      if (lastPayment) setPaymentMethod(lastPayment);
      
      setAmount('');
      setNotes('');
      if (categories.length > 0 && !hasInitializedCategory.current) {
        setCategoryId(categories[0].id);
        hasInitializedCategory.current = true;
      }
    } else {
      hasInitializedCategory.current = false;
    }
  }, [isOpen, categories]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || !categoryId) return;

    const success = addExpense({
      amount: Number(amount),
      categoryId,
      date: new Date().toISOString(),
      paymentMethod,
      notes: notes.trim() ? notes : undefined
    });

    if (success) {
      localStorage.setItem('lastPaymentMethod', paymentMethod);
      toast('Expense added successfully!', 'success');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Expense" variant="sheet" accentColor="primary">
      <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.amountInputWrapper}>
            <span className={styles.currencySymbol}>{settings.currency}</span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className={styles.amountInput}
              placeholder="0.00"
              autoFocus
              required
              inputMode="decimal"
            />
          </div>

          <div className={styles.field}>
            <label>Category</label>
            <div className={styles.categoryGrid}>
              {categories.map(cat => (
                <button
                  type="button"
                  key={cat.id}
                  className={`${styles.categoryBtn} ${categoryId === cat.id ? styles.categoryBtnActive : ''}`}
                  onClick={() => setCategoryId(cat.id)}
                >
                  <span className={styles.catIcon}>{cat.icon}</span>
                  <span className={styles.catName}>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label>Payment Method</label>
            <select 
              value={paymentMethod} 
              onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
              className={styles.select}
            >
              {PAYMENT_METHODS.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className={styles.input}
              placeholder="What was this for?"
            />
          </div>

          <button type="submit" className={styles.saveBtn}>
            Save Expense
          </button>
        </form>
    </Modal>
  );
};

export default QuickAddExpense;

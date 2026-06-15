import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import type { PaymentMethod } from '../types';
import styles from './QuickAddExpense.module.css';

interface QuickAddExpenseProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuickAddExpense: React.FC<QuickAddExpenseProps> = ({ isOpen, onClose }) => {
  const { categories, addExpense, settings } = useData();
  
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Reset state when opened, but remember last payment method from localStorage if possible
      const lastPayment = localStorage.getItem('lastPaymentMethod') as PaymentMethod;
      if (lastPayment) setPaymentMethod(lastPayment);
      
      setAmount('');
      setNotes('');
      // Auto-select most used category in a real app, for now select first
      if (categories.length > 0 && !categoryId) {
        setCategoryId(categories[0].id);
      }
    }
  }, [isOpen, categories, categoryId]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || !categoryId) return;

    addExpense({
      amount: Number(amount),
      categoryId,
      date: new Date().toISOString(), // Use full ISO string for sorting
      paymentMethod,
      notes: notes.trim() ? notes : undefined
    });

    localStorage.setItem('lastPaymentMethod', paymentMethod);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Add Expense</h2>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Close">
            <X size={24} />
          </button>
        </div>

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
              <option value="Cash">Cash</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
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
      </div>
    </div>
  );
};

export default QuickAddExpense;

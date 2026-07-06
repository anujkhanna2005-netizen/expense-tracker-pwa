import React, { useState, useEffect } from 'react';
import modalStyles from './Modal.module.css';
import styles from './EditExpenseModal.module.css';
import { X, Edit2 } from 'lucide-react';
import { useExpenses } from '../hooks/useExpenses';
import { useCategories } from '../hooks/useCategories';
import { PAYMENT_METHODS } from '../types';
import type { Expense, PaymentMethod } from '../types';

interface EditExpenseModalProps {
  isOpen: boolean;
  expense: Expense | null;
  onClose: () => void;
}

const EditExpenseModal: React.FC<EditExpenseModalProps> = ({ isOpen, expense, onClose }) => {
  const { updateExpense } = useExpenses();
  const { categories } = useCategories();
  
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (isOpen && expense) {
      setAmount(expense.amount.toString());
      setCategoryId(expense.categoryId);
      setPaymentMethod(expense.paymentMethod);
      setNotes(expense.notes || '');
      setDate(expense.date.split('T')[0]);
    }
  }, [isOpen, expense]);

  if (!isOpen || !expense) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!isNaN(numAmount) && numAmount > 0 && categoryId) {
      updateExpense(expense.id, {
        amount: numAmount,
        categoryId,
        paymentMethod,
        notes: notes.trim() ? notes : undefined,
        date: new Date(date).toISOString(),
        updatedAt: new Date().toISOString()
      });
      onClose();
    }
  };

  return (
    <div className={modalStyles.modalOverlay}>
      <div className={modalStyles.modalContent}>
        <div className={modalStyles.modalHeader}>
          <div className={modalStyles.modalTitleGroup}>
            <Edit2 size={24} className={modalStyles.targetIcon} />
            <h3 className={modalStyles.modalTitle}>Edit Expense</h3>
          </div>
          <button className={modalStyles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className={modalStyles.modalBody}>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>Amount</label>
            <input
              type="number"
              className={modalStyles.modalInput}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              min="1"
              step="0.01"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Category</label>
            <select
              className={modalStyles.modalInput}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="" disabled>Select Category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Date</label>
            <input
              type="date"
              className={modalStyles.modalInput}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Payment Method</label>
            <select
              className={modalStyles.modalInput}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              required
            >
              {PAYMENT_METHODS.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Notes (Optional)</label>
            <input
              type="text"
              className={modalStyles.modalInput}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g. Lunch with friends"
            />
          </div>
          
        </form>
        <div className={modalStyles.modalFooter}>
          <button type="button" className={modalStyles.cancelBtn} onClick={onClose}>Cancel</button>
          <button type="button" className={modalStyles.primaryBtn} onClick={handleSubmit}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditExpenseModal;

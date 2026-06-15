import React, { useState, useEffect } from 'react';
import styles from './Modal.module.css';
import { X, Edit2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import type { Expense, PaymentMethod } from '../types';

interface EditExpenseModalProps {
  isOpen: boolean;
  expense: Expense | null;
  onClose: () => void;
}

const EditExpenseModal: React.FC<EditExpenseModalProps> = ({ isOpen, expense, onClose }) => {
  const { categories, updateExpense } = useData();
  
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
      // Format date for date input (YYYY-MM-DD)
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
        date: new Date(date).toISOString(), // Preserve time if we want, or just set to midnight. The original date was probably an ISO string. We replace the date part.
        updatedAt: new Date().toISOString()
      });
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <Edit2 size={24} className={styles.targetIcon} />
            <h3 className={styles.modalTitle}>Edit Expense</h3>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Amount</label>
            <input
              type="number"
              className={styles.modalInput}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              min="1"
              step="0.01"
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Category</label>
            <select
              className={styles.modalInput}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Date</label>
            <input
              type="date"
              className={styles.modalInput}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Payment Method</label>
            <select
              className={styles.modalInput}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              required
            >
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Notes (Optional)</label>
            <input
              type="text"
              className={styles.modalInput}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g. Lunch with friends"
            />
          </div>
          
        </form>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.primaryBtn} onClick={handleSubmit}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditExpenseModal;

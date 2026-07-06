import React, { useState } from 'react';
import styles from './Modal.module.css';
import { Target, X } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/format';

import type { Goal } from '../types';

interface AddFundsModalProps {
  isOpen: boolean;
  goal: Goal | null;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}

const AddFundsModal: React.FC<AddFundsModalProps> = ({ 
  isOpen, 
  goal, 
  onConfirm, 
  onCancel 
}) => {
  const { settings } = useSettings();
  const [amount, setAmount] = useState('');

  if (!isOpen || !goal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!isNaN(numAmount) && numAmount > 0) {
      onConfirm(numAmount);
      setAmount('');
      onCancel();
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <Target size={24} className={styles.targetIcon} />
            <h3 className={styles.modalTitle}>Add Funds</h3>
          </div>
          <button className={styles.closeBtn} onClick={onCancel}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <p className={styles.modalMessage}>
            How much would you like to add to <strong>{goal.name}</strong>?
          </p>
          <div className={styles.infoBox}>
            <span>Current Progress:</span>
            <strong>{formatCurrency(goal.currentAmount, settings.currency)}</strong>
          </div>
          <input
            type="number"
            className={styles.modalInput}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Amount (e.g. 500)`}
            min="1"
            step="0.01"
            required
            autoFocus
          />
        </form>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button type="button" className={styles.primaryBtn} onClick={handleSubmit}>
            Add Funds
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddFundsModal;

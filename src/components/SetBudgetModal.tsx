import React, { useState, useEffect } from 'react';
import styles from './Modal.module.css';
import { Target, X } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';

interface SetBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SetBudgetModal: React.FC<SetBudgetModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings } = useSettings();
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAmount(settings.monthlyBudgetLimit ? settings.monthlyBudgetLimit.toString() : '');
    }
  }, [isOpen, settings.monthlyBudgetLimit]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!isNaN(numAmount) && numAmount >= 0) {
      updateSettings({ monthlyBudgetLimit: numAmount });
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <Target size={24} className={styles.targetIcon} />
            <h3 className={styles.modalTitle}>Set Monthly Budget</h3>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <p className={styles.modalMessage}>
            Enter your target spending limit for the month.
          </p>
          <div className={styles.infoBox}>
            <span>Currency:</span>
            <strong>{settings.currency}</strong>
          </div>
          <input
            type="number"
            className={styles.modalInput}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Amount (e.g. 50000)`}
            min="0"
            required
            autoFocus
          />
        </form>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.primaryBtn} onClick={handleSubmit}>
            Save Budget
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetBudgetModal;

import React, { useState } from 'react';
import { Delete, Lock, RotateCcw } from 'lucide-react';
import { useToast } from './ui/ToastProvider';
import storageService from '../services/storageService';
import styles from './PinLockScreen.module.css';

interface PinLockScreenProps {
  onUnlock: (pin: string) => Promise<boolean>;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { toast } = useToast();

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  const handleSubmit = async () => {
    if (pin.length < 4) {
      toast('PIN must be at least 4 digits', 'error');
      setError(true);
      return;
    }

    const success = await onUnlock(pin);
    if (!success) {
      setError(true);
      setPin('');
      toast('Incorrect PIN', 'error');
    }
  };

  const handleResetData = async () => {
    if (!window.confirm('WARNING: Erasing all data will permanently delete your expenses, settings, and files. This cannot be undone. Are you sure you want to proceed?')) {
      return;
    }
    
    setIsResetting(true);
    try {
      await storageService.clear();
      toast('All data has been reset successfully.', 'success');
      // Reload page to return to uninitialized state
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      toast('Failed to reset data', 'error');
      setIsResetting(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.lockContainer}>
        <div className={styles.header}>
          <div className={styles.iconContainer}>
            <Lock size={32} />
          </div>
          <h2>App Locked</h2>
          <p>Enter your PIN to access Expense Tracker</p>
        </div>

        <div className={`${styles.dots} ${error ? styles.shake : ''}`}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`${styles.dot} ${pin.length > i ? styles.active : ''}`}
            />
          ))}
        </div>

        <div className={styles.keypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              className={styles.key}
              onClick={() => handleKeyPress(num)}
              disabled={isResetting}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.key} ${styles.actionKey}`}
            onClick={handleClear}
            disabled={isResetting}
            aria-label="Clear"
          >
            C
          </button>
          <button
            type="button"
            className={styles.key}
            onClick={() => handleKeyPress('0')}
            disabled={isResetting}
          >
            0
          </button>
          <button
            type="button"
            className={`${styles.key} ${styles.actionKey}`}
            onClick={handleBackspace}
            disabled={isResetting}
            aria-label="Backspace"
          >
            <Delete size={20} />
          </button>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={isResetting}
          >
            Unlock App
          </button>

          <button
            type="button"
            className={styles.resetBtn}
            onClick={handleResetData}
            disabled={isResetting}
          >
            <RotateCcw size={14} style={{ marginRight: '6px' }} />
            Forgot PIN? Reset Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default PinLockScreen;

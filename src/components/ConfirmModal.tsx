import React from 'react';
import styles from './Modal.module.css';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = "Delete"
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <AlertTriangle size={24} className={styles.dangerIcon} />
            <h3 className={styles.modalTitle}>{title}</h3>
          </div>
          <button className={styles.closeBtn} onClick={onCancel}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.modalMessage}>{message}</p>
          <p className={styles.modalWarning}>This action cannot be undone.</p>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button className={styles.dangerBtn} onClick={() => { onConfirm(); onCancel(); }}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;

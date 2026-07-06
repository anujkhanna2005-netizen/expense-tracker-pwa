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
  onClose?: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = "Delete",
  onClose
}) => {
  if (!isOpen) return null;

  const handleClose = onClose || onCancel;

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <AlertTriangle size={24} className={styles.dangerIcon} />
            <h3 className={styles.modalTitle}>{title}</h3>
          </div>
          <button className={styles.closeBtn} onClick={handleClose}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.modalMessage}>{message}</p>
          <p className={styles.modalWarning}>This action cannot be undone.</p>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button className={styles.dangerBtn} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;

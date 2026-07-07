import React from 'react';
import styles from './Modal.module.css';
import Modal from './ui/Modal';

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
  const handleClose = onClose || onCancel;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} variant="dialog" accentColor="danger">
      <div className={styles.modalBody} style={{ padding: 0 }}>
        <p className={styles.modalMessage}>{message}</p>
        <p className={styles.modalWarning} style={{ marginTop: '8px' }}>This action cannot be undone.</p>
      </div>
      <div className={styles.modalFooter} style={{ margin: '20px -20px -20px -20px', padding: '16px 20px' }}>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
        <button className={styles.dangerBtn} onClick={onConfirm}>
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;

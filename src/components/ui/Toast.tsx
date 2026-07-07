import React from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import clsx from 'clsx';
import type { ToastItem } from './ToastProvider';
import styles from './Toast.module.css';

interface ToastProps {
  toast: ToastItem;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className={styles.successIcon} size={18} />;
      case 'error':
        return <AlertCircle className={styles.errorIcon} size={18} />;
      case 'info':
      default:
        return <Info className={styles.infoIcon} size={18} />;
    }
  };

  return (
    <div className={clsx(styles.toast, styles[toast.type])} role="alert">
      <span className={styles.iconContainer}>{getIcon()}</span>
      <span className={styles.message}>{toast.message}</span>
      {toast.action && (
        <button
          className={styles.actionBtn}
          onClick={() => {
            toast.action?.onClick();
            onClose();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastItem[];
  removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className={styles.toastContainer} aria-live="polite">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

export default ToastContainer;

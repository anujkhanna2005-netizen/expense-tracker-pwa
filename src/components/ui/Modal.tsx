import React, { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import styles from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  variant?: 'dialog' | 'sheet';
  children: React.ReactNode;
  accentColor?: 'primary' | 'income' | 'danger';
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  variant = 'dialog',
  children,
  accentColor = 'primary'
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Apply our reusable focus-trap hook
  useFocusTrap(modalRef, isOpen);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const titleId = `modal-title-${title.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div
      className={clsx(styles.overlay, styles[variant])}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={modalRef}
        className={clsx(
          styles.content,
          styles[variant],
          styles[accentColor]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>
        <div className={styles.body}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;

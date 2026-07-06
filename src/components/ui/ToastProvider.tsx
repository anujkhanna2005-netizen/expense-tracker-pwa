import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import ToastContainer from './Toast';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toast: (message: string, type?: 'success' | 'error' | 'info', action?: { label: string; onClick: () => void }) => void;
  removeToast: (id: string) => void;
  toasts: ToastItem[];
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
    action?: { label: string; onClick: () => void }
  ) => {
    const id = crypto.randomUUID();
    const duration = type === 'error' ? 6000 : 4000;

    setToasts((prev) => [...prev, { id, message, type, action }]);

    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast, removeToast, toasts }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

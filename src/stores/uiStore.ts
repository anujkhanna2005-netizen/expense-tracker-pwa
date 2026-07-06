import { create } from 'zustand';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface UiState {
  toasts: ToastItem[];
  addToast: (message: string, type?: 'success' | 'error' | 'info', action?: { label: string; onClick: () => void }) => void;
  removeToast: (id: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  addToast: (message, type = 'info', action) => {
    const id = crypto.randomUUID();
    const duration = type === 'error' ? 6000 : 4000;

    set((state) => ({
      toasts: [...state.toasts, { id, message, type, action }]
    }));

    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }));
    }, duration);
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  }
}));
export default useUiStore;

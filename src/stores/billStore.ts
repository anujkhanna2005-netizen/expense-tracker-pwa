import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customPersistStorage } from './customStorage';
import { billSchema } from '../utils/validation';
import { useUiStore } from './uiStore';
import type { Bill } from '../types';

interface BillState {
  bills: Bill[];
  addBill: (billData: Omit<Bill, 'id'>) => boolean;
  updateBill: (id: string, updates: Partial<Bill>) => boolean;
  deleteBill: (id: string) => void;
  setBills: (bills: Bill[]) => void;
  resetBills: () => void;
}

export const useBillStore = create<BillState>()(
  persist(
    (set, get) => ({
      bills: [],

      addBill: (billData) => {
        const newBill: Bill = {
          ...billData,
          id: crypto.randomUUID()
        };
        const validation = billSchema.safeParse(newBill);
        if (!validation.success) {
          const errMsg = validation.error.issues[0]?.message || 'Invalid bill data';
          useUiStore.getState().addToast(errMsg, 'error');
          return false;
        }

        set((state) => ({ bills: [...state.bills, newBill] }));
        return true;
      },

      updateBill: (id, updates) => {
        const bills = get().bills;
        const index = bills.findIndex((b) => b.id === id);
        if (index === -1) return false;

        const nextBill = {
          ...bills[index],
          ...updates
        };

        const validation = billSchema.safeParse(nextBill);
        if (!validation.success) {
          const errMsg = validation.error.issues[0]?.message || 'Invalid bill data';
          useUiStore.getState().addToast(errMsg, 'error');
          return false;
        }

        set((state) => ({
          bills: state.bills.map((b) => (b.id === id ? nextBill : b))
        }));
        return true;
      },

      deleteBill: (id) => {
        set((state) => ({
          bills: state.bills.filter((b) => b.id !== id)
        }));
      },

      setBills: (bills) => set({ bills }),

      resetBills: () => set({ bills: [] }),
    }),
    {
      name: 'bills',
      storage: customPersistStorage,
      partialize: (state) => ({ bills: state.bills }),
    }
  )
);

export default useBillStore;

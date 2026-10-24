import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { customPersistStorage } from './customStorage';
import { useExpenseStore } from './expenseStore';
import { useIncomeStore } from './incomeStore';
import { useSettingsStore } from './settingsStore';
import { useUiStore } from './uiStore';
import type { Expense } from '../types';
import type { Income } from '../types/income';
import {
  extractCleanPayee,
  getFriendlySourceName,
  type SourceAlertInfo,
} from '../services/transactionClassifier';

export interface CapturedTransactionItem {
  id: string;
  sourcePackage: string;
  sourceAppName: string;
  combinedSources?: string[];
  sourceAlerts?: SourceAlertInfo[];
  title: string;
  rawText: string;
  amount: number;
  direction: 'expense' | 'income' | 'transfer';
  isRefund?: boolean;
  isReversal?: boolean;
  isTransfer?: boolean;
  linkedExpenseId?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  timestamp: number;
  payee: string;
  categoryId: string;
  confidence: 'high' | 'needs_review';
  confidenceReason?: string;
  upiRef?: string;
  accountLast4?: string;
  status: 'pending' | 'approved' | 'dismissed';
  isPossibleDuplicate?: boolean;
  possibleDuplicateOf?: string;
}

interface CapturedState {
  pendingItems: CapturedTransactionItem[];
  historyItems: CapturedTransactionItem[]; // last 50 processed items for reference/audit
  seenNotificationIds: string[]; // Notification Identity: detects exact same notification delivered again
  processedTransactionIds: string[]; // Transaction Identity: identifies real underlying payment across apps
  processedSignatures: string[]; // Legacy compatibility signature store
  lastCleanupBackup: { timestamp: number; expenses: Expense[]; incomes: Income[] } | null;
  addCapturedItems: (items: CapturedTransactionItem[]) => number;
  updateCapturedItem: (id: string, updates: Partial<CapturedTransactionItem>) => void;
  approveItem: (id: string, rememberMerchant?: boolean) => boolean;
  dismissItem: (id: string) => void;
  approveAllHighConfidence: () => number;
  dismissAll: () => void;
  clearHistory: () => void;
  setCleanupBackup: (backup: { expenses: Expense[]; incomes: Income[] }) => void;
  undoLastCleanup: () => boolean;
}

export function parsePayee(title: string, text: string, packageName: string): string {
  return extractCleanPayee(title, text, packageName);
}

export function getSourceAppName(packageName: string, title: string): string {
  return getFriendlySourceName(packageName, title);
}

/**
 * Notification Identity: uniquely identifies an individual notification delivery event.
 */
export function getNotificationIdentity(item: Pick<CapturedTransactionItem, 'id'>): string {
  return item.id;
}

/**
 * Transaction Identity: identifies the underlying real-world payment.
 * When a stable reference (UPI Ref / RRN / UTR) is present, it keys on the reference.
 * Otherwise it includes normalized timestamp and delivery ID so two payments on the same day
 * at different times are recognized as distinct financial events.
 */
export function getTransactionIdentity(
  item: Pick<CapturedTransactionItem, 'direction' | 'amount' | 'date' | 'upiRef' | 'payee' | 'timestamp' | 'id'>
): string {
  if (item.upiRef && item.upiRef.trim().length > 0) {
    return `tx_ref_${item.direction}_${item.amount.toFixed(2)}_${item.upiRef.trim()}`;
  }
  // For unreferenced transactions, incorporate normalized timestamp and ID to avoid dropping distinct payments
  return `tx_unref_${item.direction}_${item.amount.toFixed(2)}_${item.date}_${item.timestamp}_${item.id}`;
}

/**
 * Legacy signature helper preserved for backwards compatibility.
 */
export function getItemSignature(
  item: Pick<CapturedTransactionItem, 'direction' | 'amount' | 'date' | 'upiRef' | 'payee' | 'rawText' | 'timestamp' | 'id'>
): string {
  return getTransactionIdentity(item);
}

export const useCapturedStore = create<CapturedState>()(
  persist(
    (set, get) => ({
      pendingItems: [],
      historyItems: [],
      seenNotificationIds: [],
      processedTransactionIds: [],
      processedSignatures: [],
      lastCleanupBackup: null,

      addCapturedItems: (items) => {
        const currentPending = get().pendingItems;
        const currentHistory = get().historyItems;
        const seenNotifs = new Set(get().seenNotificationIds || []);
        const processedTxns = new Set(get().processedTransactionIds || []);
        const processedLegacy = new Set(get().processedSignatures || []);
        const newItems: CapturedTransactionItem[] = [];

        for (const item of items) {
          const notifId = getNotificationIdentity(item);
          const txId = getTransactionIdentity(item);

          // 1. Notification Identity: Detect re-delivery of the exact same notification
          if (seenNotifs.has(notifId)) continue;
          if (currentPending.some((p) => p.id === item.id)) continue;
          if (currentHistory.some((h) => h.id === item.id)) continue;

          // 2. Transaction Identity: If stable reference exists, check if already recorded
          if (item.upiRef && (processedTxns.has(txId) || processedLegacy.has(txId))) {
            continue;
          }

          // If stable reference already exists in pending queue, don't duplicate
          if (
            item.upiRef &&
            currentPending.some(
              (p) =>
                p.upiRef === item.upiRef &&
                p.direction === item.direction &&
                Math.abs(p.amount - item.amount) < 0.001
            )
          ) {
            continue;
          }

          // Note: If item is flagged as possible duplicate or has no reference and different timestamp/id,
          // it MUST be preserved for review and never silently discarded!
          newItems.push(item);
        }

        if (newItems.length > 0) {
          const updatedSeenNotifs = Array.from(
            new Set([...newItems.map(getNotificationIdentity), ...seenNotifs])
          ).slice(-500);

          set({
            pendingItems: [...newItems, ...currentPending],
            seenNotificationIds: updatedSeenNotifs,
          });
        }
        return newItems.length;
      },

      updateCapturedItem: (id, updates) => {
        set((state) => ({
          pendingItems: state.pendingItems.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      },

      approveItem: (id, rememberMerchant = false) => {
        const item = get().pendingItems.find((p) => p.id === id);
        if (!item) return false;

        let success = false;

        // 1. Handle Internal Transfers (Outflow or Inflow between user's own accounts)
        if (item.isTransfer || item.direction === 'transfer') {
          if (item.direction === 'expense') {
            success = useExpenseStore.getState().addExpense({
              amount: item.amount,
              categoryId: item.categoryId || 'cat-other',
              date: item.date,
              notes: item.payee || 'Internal Transfer',
              paymentMethod: 'Bank Transfer',
              isTransfer: true,
            });
          } else {
            success = useIncomeStore.getState().addIncome({
              amount: item.amount,
              source: 'Transfer',
              date: item.date,
              notes: item.payee || 'Internal Transfer',
              isRecurring: false,
              isTransfer: true,
            });
          }
        }
        // 2. Handle Reversal of a failed/cancelled payment
        else if (item.isReversal) {
          let linkedExpId = item.linkedExpenseId;
          const expStore = useExpenseStore.getState();

          // If not explicitly linked, find matching recent expense to link
          if (!linkedExpId) {
            const candidateExp = expStore.expenses.find(
              (e) =>
                !e.isReversed &&
                Math.abs(e.amount - item.amount) < 0.001 &&
                (item.upiRef ? (e.notes || '').includes(item.upiRef) : true)
            );
            if (candidateExp) {
              linkedExpId = candidateExp.id;
            }
          }

          if (linkedExpId) {
            expStore.updateExpense(linkedExpId, { isReversed: true });
          }

          success = useIncomeStore.getState().addIncome({
            amount: item.amount,
            source: 'Reversal',
            date: item.date,
            notes: item.payee || `Reversal of payment`,
            isRecurring: false,
            isReversal: true,
            linkedExpenseId: linkedExpId,
          });
        }
        // 3. Handle Purchase Refund
        else if (item.isRefund) {
          let linkedExpId = item.linkedExpenseId;
          const expStore = useExpenseStore.getState();

          if (!linkedExpId) {
            const candidateExp = expStore.expenses.find(
              (e) =>
                !e.isReversed &&
                Math.abs(e.amount - item.amount) < 0.001 &&
                (item.upiRef ? (e.notes || '').includes(item.upiRef) : true)
            );
            if (candidateExp) {
              linkedExpId = candidateExp.id;
            }
          }

          if (linkedExpId) {
            const existingExp = expStore.expenses.find((e) => e.id === linkedExpId);
            if (existingExp) {
              const updatedRefunded = (existingExp.refundedAmount || 0) + item.amount;
              expStore.updateExpense(linkedExpId, {
                refundedAmount: updatedRefunded,
                isReversed: updatedRefunded >= existingExp.amount,
              });
            }
          }

          success = useIncomeStore.getState().addIncome({
            amount: item.amount,
            source: 'Refund',
            date: item.date,
            notes: item.payee || 'Refund',
            isRecurring: false,
            linkedExpenseId: linkedExpId,
          });
        }
        // 4. Regular Income
        else if (item.direction === 'income') {
          success = useIncomeStore.getState().addIncome({
            amount: item.amount,
            source: 'Other',
            date: item.date,
            notes: item.payee || item.rawText.slice(0, 100),
            isRecurring: false,
          });
        }
        // 5. Regular Expense
        else {
          success = useExpenseStore.getState().addExpense({
            amount: item.amount,
            categoryId: item.categoryId,
            date: item.date,
            notes: item.payee || item.rawText.slice(0, 100),
            paymentMethod: item.sourceAppName.toLowerCase().includes('card')
              ? 'Credit Card'
              : 'UPI',
          });
        }

        if (success) {
          if (rememberMerchant && item.payee) {
            useSettingsStore.getState().setMerchantCategory(item.payee, item.categoryId);
          }

          const notifId = getNotificationIdentity(item);
          const txId = getTransactionIdentity(item);
          const approvedRecord: CapturedTransactionItem = { ...item, status: 'approved' };

          const nextNotifIds = Array.from(new Set([notifId, ...(get().seenNotificationIds || [])])).slice(-500);
          const nextTxIds = Array.from(new Set([txId, ...(get().processedTransactionIds || [])])).slice(-500);
          const nextSignatures = Array.from(new Set([txId, ...(get().processedSignatures || [])])).slice(-500);

          set((state) => ({
            pendingItems: state.pendingItems.filter((p) => p.id !== id),
            historyItems: [approvedRecord, ...state.historyItems.slice(0, 49)],
            seenNotificationIds: nextNotifIds,
            processedTransactionIds: nextTxIds,
            processedSignatures: nextSignatures,
          }));

          const label = item.isTransfer
            ? 'transfer'
            : item.isReversal
            ? 'reversal'
            : item.isRefund
            ? 'refund'
            : item.direction;

          useUiStore
            .getState()
            .addToast(
              `Saved ${label} of ₹${item.amount}`,
              'success'
            );
        }
        return success;
      },

      dismissItem: (id) => {
        const item = get().pendingItems.find((p) => p.id === id);
        if (!item) return;

        const notifId = getNotificationIdentity(item);
        const txId = getTransactionIdentity(item);
        const dismissedRecord: CapturedTransactionItem = { ...item, status: 'dismissed' };

        const nextNotifIds = Array.from(new Set([notifId, ...(get().seenNotificationIds || [])])).slice(-500);
        const nextTxIds = Array.from(new Set([txId, ...(get().processedTransactionIds || [])])).slice(-500);
        const nextSignatures = Array.from(new Set([txId, ...(get().processedSignatures || [])])).slice(-500);

        set((state) => ({
          pendingItems: state.pendingItems.filter((p) => p.id !== id),
          historyItems: [dismissedRecord, ...state.historyItems.slice(0, 49)],
          seenNotificationIds: nextNotifIds,
          processedTransactionIds: nextTxIds,
          processedSignatures: nextSignatures,
        }));
        useUiStore.getState().addToast('Transaction alert dismissed', 'info');
      },

      approveAllHighConfidence: () => {
        const highItems = get().pendingItems.filter(
          (p) => p.confidence === 'high' && !p.isPossibleDuplicate && !p.isRefund && !p.isReversal && !p.isTransfer
        );
        let count = 0;
        for (const item of highItems) {
          if (get().approveItem(item.id, false)) {
            count += 1;
          }
        }
        return count;
      },

      dismissAll: () => {
        const allPending = get().pendingItems.map((p) => ({ ...p, status: 'dismissed' as const }));
        const notifIds = allPending.map(getNotificationIdentity);
        const txIds = allPending.map(getTransactionIdentity);

        const nextNotifIds = Array.from(new Set([...notifIds, ...(get().seenNotificationIds || [])])).slice(-500);
        const nextTxIds = Array.from(new Set([...txIds, ...(get().processedTransactionIds || [])])).slice(-500);
        const nextSignatures = Array.from(new Set([...txIds, ...(get().processedSignatures || [])])).slice(-500);

        set((state) => ({
          pendingItems: [],
          historyItems: [...allPending, ...state.historyItems].slice(0, 50),
          seenNotificationIds: nextNotifIds,
          processedTransactionIds: nextTxIds,
          processedSignatures: nextSignatures,
        }));
        useUiStore.getState().addToast('All captured alerts dismissed', 'info');
      },

      clearHistory: () =>
        set({
          historyItems: [],
          seenNotificationIds: [],
          processedTransactionIds: [],
          processedSignatures: [],
        }),

      setCleanupBackup: (backup) =>
        set({ lastCleanupBackup: { timestamp: Date.now(), ...backup } }),

      undoLastCleanup: () => {
        const backup = get().lastCleanupBackup;
        if (!backup || (backup.expenses.length === 0 && backup.incomes.length === 0)) return false;

        const currentExpenses = useExpenseStore.getState().expenses;
        const currentIncomes = useIncomeStore.getState().incomes;

        useExpenseStore.getState().setExpenses([...currentExpenses, ...backup.expenses]);
        useIncomeStore.getState().setIncomes([...currentIncomes, ...backup.incomes]);

        set({ lastCleanupBackup: null });
        useUiStore.getState().addToast(
          `Restored ${backup.expenses.length} expense(s) and ${backup.incomes.length} income(s)`,
          'success'
        );
        return true;
      },
    }),
    {
      name: 'captured-transactions-storage',
      storage: customPersistStorage,
    }
  )
);


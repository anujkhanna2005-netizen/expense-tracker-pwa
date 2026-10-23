import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Category, Expense } from '../types';

interface NativeTransaction {
  id: string;
  packageName: string;
  title: string;
  text: string;
  amount: number;
  timestamp: number;
}

interface CapturePlugin {
  getStatus(): Promise<{ enabled: boolean }>;
  openAccessSettings(): Promise<void>;
  drainTransactions(): Promise<{ transactions: NativeTransaction[] }>;
}

const TransactionCapture = registerPlugin<CapturePlugin>('TransactionCapture');

export const transactionCaptureService = {
  isNative: () => Capacitor.getPlatform() === 'android',
  getStatus: async () => Capacitor.getPlatform() === 'android' ? TransactionCapture.getStatus() : { enabled: false },
  openAccessSettings: () => TransactionCapture.openAccessSettings(),
  async importPending(categories: Category[], addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => boolean) {
    if (Capacitor.getPlatform() !== 'android') return 0;
    const { transactions } = await TransactionCapture.drainTransactions();
    if (transactions.length === 0) return 0;
    const { suggestCategory } = await import('./statementImportService');
    let imported = 0;
    for (const transaction of transactions) {
      const description = `${transaction.title} ${transaction.text}`.replace(/\s+/g, ' ').trim().slice(0, 240);
      const categoryId = suggestCategory(description, categories);
      const date = new Date(transaction.timestamp).toISOString().slice(0, 10);
      const paymentMethod: Expense['paymentMethod'] = /upi/i.test(`${transaction.packageName} ${description}`) ? 'UPI' : 'Bank Transfer';
      if (transaction.amount > 0 && addExpense({
        amount: transaction.amount,
        categoryId,
        date,
        notes: description,
        paymentMethod,
      })) imported += 1;
    }
    return imported;
  },
};

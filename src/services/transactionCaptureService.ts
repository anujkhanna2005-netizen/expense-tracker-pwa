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

/** Infer the payment method from the notification package name and text. */
function inferPaymentMethod(packageName: string, description: string): Expense['paymentMethod'] {
  const combined = `${packageName} ${description}`.toLowerCase();
  if (/\bneft\b/.test(combined)) return 'Bank Transfer';
  if (/\bimps\b/.test(combined)) return 'Bank Transfer';
  if (/\brtgs\b/.test(combined)) return 'Bank Transfer';
  if (/\bupi\b/.test(combined)) return 'UPI';
  // UPI app packages
  const upiPackages = [
    'com.phonepe.app', 'com.google.android.apps.nbu.paisa.user',
    'net.one97.paytm', 'com.lcode.bhimupi', 'in.bhimupi',
    'in.org.npci.upiapp', 'com.whatsapp',
  ];
  if (upiPackages.includes(packageName)) return 'UPI';
  return 'Bank Transfer';
}

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
      const paymentMethod = inferPaymentMethod(transaction.packageName, description);
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


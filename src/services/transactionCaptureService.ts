import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Category, Expense } from '../types';
import type { Income } from '../types/income';
import { useExpenseStore } from '../stores/expenseStore';
import { useIncomeStore } from '../stores/incomeStore';
import { useSettingsStore } from '../stores/settingsStore';
import {
  useCapturedStore,
  parsePayee,
  getSourceAppName,
  type CapturedTransactionItem,
} from '../stores/capturedTransactionStore';
import { suggestCategoryWithConfidence } from './statementImportService';

export interface NativeTransaction {
  id: string;
  packageName: string;
  title: string;
  text: string;
  amount: number;
  type?: 'expense' | 'income';
  timestamp: number;
  upiRef?: string;
  accountLast4?: string;
}

interface CapturePlugin {
  getStatus(): Promise<{ enabled: boolean }>;
  openAccessSettings(): Promise<void>;
  drainTransactions(options?: { autoClear?: boolean }): Promise<{ transactions: NativeTransaction[] }>;
  ackTransactions(options: { ids: string[] }): Promise<void>;
}

const TransactionCapture = registerPlugin<CapturePlugin>('TransactionCapture');

/** Comprehensive marketing, promotional, cashback, loan, bill reminder, and failed/pending patterns to exclude. */
export const PROMO_REGEX =
  /\b(?:upto|up to|get upto|win upto|earn upto|cashback\*?|cash back\*?|scratch card|reward points?|supercoins?|voucher|coupon|discount|promo(?: code)?|flat\s*(?:rs|₹|inr|cashback)|%\s*off|save\s*(?:up to|rs|₹|inr)|win\s*(?:rs|₹|inr|cashback)|chance to win|stand a chance|lucky winner|earn\s*(?:rs|₹|inr|cashback)|claim your|claim now|hurry|refer(?:ral)?|invite friends?|use\s+(?:amazon\s*pay|paytm|phonepe|gpay|google\s*pay)\s+upi|for\s+amazon\s*shopping|pay\s+with\s+amazon\s*pay|exclusive offer|pre-?approved|instant loan|personal loan|credit score|cibil|bill is due|bill due|due date|due on|upcoming bill|bill generated|reminder:|payment reminder|has requested|requested money|payment request|request from|split bill|failed|declined|unsuccessful|timed out|could not process|cancelled|canceled|payment pending|txn pending|pending payment)\b/i;

/** Chat media counters or photo indicators that must never be treated as monetary amounts. */
export const CHAT_OR_MEDIA_REGEX =
  /(?:📷|\b\d+\s*(?:photos?|images?|videos?|files?|audios?|messages?|contacts?|documents?|attachments?)\b)/i;

/** Infer payment method from package name and text. */
export function inferPaymentMethod(packageName: string, description: string): Expense['paymentMethod'] {
  const combined = `${packageName} ${description}`.toLowerCase();
  if (/\bneft\b/.test(combined)) return 'Bank Transfer';
  if (/\bimps\b/.test(combined)) return 'Bank Transfer';
  if (/\brtgs\b/.test(combined)) return 'Bank Transfer';
  if (/\bcredit\s*card\b/.test(combined)) return 'Credit Card';
  if (/\bdebit\s*card\b/.test(combined)) return 'Debit Card';
  if (/\bcard\b/.test(combined)) return 'Credit Card';
  if (/\bupi\b/.test(combined)) return 'UPI';

  const upiPackages = [
    'com.phonepe.app',
    'com.phonepe.app.preprod',
    'com.google.android.apps.nbu.paisa.user',
    'net.one97.paytm',
    'com.lcode.bhimupi',
    'in.bhimupi',
    'in.org.npci.upiapp',
    'com.dreamplug.androidapp',
    'com.hdfcbank.payzapp',
    'com.enstage.wibmo.hdfc',
    'money.jupiter',
    'money.fi',
    'indwin.c3.shareapp',
    'org.isometrik.mslice',
    'com.naviapp',
    'money.super',
    'money.super.payments',
    'com.samsung.android.spay',
    'com.tatadigital.tcp',
    'com.amazonpay',
    'in.amazon.mShop.android.shopping',
  ];
  if (upiPackages.includes(packageName)) return 'UPI';
  return 'Bank Transfer';
}

import {
  correlateAndDeduplicate,
  type DeduplicatedTransaction,
} from './transactionClassifier';

/**
 * Filter out promotional/chat alerts and deduplicate multi-channel notifications
 * (e.g., when Slice app and HDFC bank SMS both report the exact same payment).
 */
export function deduplicateBatch(transactions: NativeTransaction[]): DeduplicatedTransaction[] {
  return correlateAndDeduplicate(transactions);
}

export interface ImportResult {
  expenses: number;
  incomes: number;
  queuedForReview: number;
}

export const transactionCaptureService = {
  isNative: () => Capacitor.getPlatform() === 'android',
  getStatus: async () => (Capacitor.getPlatform() === 'android' ? TransactionCapture.getStatus() : { enabled: false }),
  openAccessSettings: () => TransactionCapture.openAccessSettings(),

  async importPending(
    categories: Category[],
    addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => boolean,
    addIncome?: (income: Omit<Income, 'id' | 'createdAt' | 'updatedAt'>) => boolean,
  ): Promise<ImportResult> {
    if (Capacitor.getPlatform() !== 'android') return { expenses: 0, incomes: 0, queuedForReview: 0 };
    const { transactions } = await TransactionCapture.drainTransactions({ autoClear: false });
    const list = Array.isArray(transactions) ? transactions : [];
    if (list.length === 0) return { expenses: 0, incomes: 0, queuedForReview: 0 };

    const validBatch = deduplicateBatch(list);
    if (validBatch.length === 0) {
      try {
        const idsToAck = list.map((t) => t.id).filter(Boolean);
        if (idsToAck.length > 0) await TransactionCapture.ackTransactions({ ids: idsToAck });
      } catch (ignored) {}
      return { expenses: 0, incomes: 0, queuedForReview: 0 };
    }

    let expenses = 0;
    let incomes = 0;
    let queuedForReview = 0;

    const settings = useSettingsStore.getState().settings;
    const autoApprove = Boolean(settings.autoImportHighConfidence);

    const existingExpenses = useExpenseStore.getState().expenses;
    const existingIncomes = useIncomeStore.getState().incomes;
    const capturedItemsToQueue: CapturedTransactionItem[] = [];

    for (const transaction of validBatch) {
      const description = `${transaction.title} ${transaction.text}`.replace(/\s+/g, ' ').trim().slice(0, 240);
      const rawTs = Number(transaction.timestamp) || 0;
      const ts = rawTs > 0 ? (rawTs < 1e11 ? rawTs * 1000 : rawTs) : Date.now();
      const d = new Date(ts);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const date = `${year}-${month}-${day}`;
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const time = `${hours}:${minutes}`;

      const payee = transaction.payee || parsePayee(transaction.title, transaction.text, transaction.packageName);
      const sourceAppName = transaction.sourceAppName || getSourceAppName(transaction.packageName, transaction.title);
      const direction = transaction.direction;

      const { categoryId, confidence: catConfidence, reason: catReason } = suggestCategoryWithConfidence(
        `${payee} ${description}`,
        categories,
        settings.merchantCategoryMap
      );

      // ── Safe Identity & Duplication Verification ──
      // Only treat as already existing in DB if stable reference matches, or if explicit exact delivery ID was already saved.
      // Do NOT silently drop based on equal amount or time alone!
      if (direction === 'income') {
        const alreadyRecordedWithRef = Boolean(
          transaction.upiRef &&
          existingIncomes.some((existing) => (existing.notes || '').includes(transaction.upiRef!))
        );
        if (alreadyRecordedWithRef) continue;

        // If amount and date match an existing entry but without stable reference proof, flag for review rather than dropping!
        const possibleDuplicateMatch = existingIncomes.some(
          (existing) => existing.date === date && Math.abs(existing.amount - transaction.amount) < 0.001
        );

        const isHighConfidence =
          transaction.confidence === 'high' &&
          catConfidence === 'high' &&
          !transaction.isPossibleDuplicate &&
          !possibleDuplicateMatch &&
          !transaction.isRefund &&
          !transaction.isReversal &&
          !transaction.isTransfer;

        if (autoApprove && isHighConfidence && addIncome) {
          const success = addIncome({
            amount: transaction.amount,
            source: 'Other',
            date,
            notes: payee || description,
            isRecurring: false,
          });
          if (success) incomes += 1;
        } else {
          capturedItemsToQueue.push({
            id: transaction.id,
            sourcePackage: transaction.packageName,
            sourceAppName,
            combinedSources: transaction.combinedSources,
            sourceAlerts: transaction.sourceAlerts,
            title: transaction.title,
            rawText: transaction.text,
            amount: transaction.amount,
            direction: 'income',
            isRefund: transaction.isRefund,
            isReversal: transaction.isReversal,
            isTransfer: transaction.isTransfer,
            linkedExpenseId: transaction.linkedExpenseId,
            date,
            time,
            timestamp: ts,
            payee,
            categoryId,
            confidence: isHighConfidence ? 'high' : 'needs_review',
            confidenceReason: transaction.confidenceReason || (possibleDuplicateMatch ? 'Same amount and date as existing recorded income' : catReason),
            upiRef: transaction.upiRef,
            accountLast4: transaction.accountLast4,
            status: 'pending',
            isPossibleDuplicate: transaction.isPossibleDuplicate || possibleDuplicateMatch,
            possibleDuplicateOf: transaction.possibleDuplicateOf,
          });
        }
      } else if (direction === 'transfer') {
        // Internal transfers always go to Review queue unless explicitly confirmed
        capturedItemsToQueue.push({
          id: transaction.id,
          sourcePackage: transaction.packageName,
          sourceAppName,
          combinedSources: transaction.combinedSources,
          sourceAlerts: transaction.sourceAlerts,
          title: transaction.title,
          rawText: transaction.text,
          amount: transaction.amount,
          direction: 'transfer',
          isTransfer: true,
          date,
          time,
          timestamp: ts,
          payee: payee || 'Self / Internal Transfer',
          categoryId,
          confidence: 'needs_review',
          confidenceReason: 'Internal transfer between accounts requires confirmation',
          upiRef: transaction.upiRef,
          accountLast4: transaction.accountLast4,
          status: 'pending',
          isPossibleDuplicate: transaction.isPossibleDuplicate,
          possibleDuplicateOf: transaction.possibleDuplicateOf,
        });
      } else {
        // Direction is expense
        const alreadyRecordedWithRef = Boolean(
          transaction.upiRef &&
          existingExpenses.some((existing) => (existing.notes || '').includes(transaction.upiRef!))
        );
        if (alreadyRecordedWithRef) continue;

        const possibleDuplicateMatch = existingExpenses.some(
          (existing) => existing.date === date && Math.abs(existing.amount - transaction.amount) < 0.001
        );

        const isHighConfidence =
          transaction.confidence === 'high' &&
          catConfidence === 'high' &&
          !transaction.isPossibleDuplicate &&
          !possibleDuplicateMatch &&
          !transaction.isTransfer;

        if (autoApprove && isHighConfidence) {
          const paymentMethod = inferPaymentMethod(transaction.packageName, description);
          const success = addExpense({
            amount: transaction.amount,
            categoryId,
            date,
            notes: payee || description,
            paymentMethod,
          });
          if (success) expenses += 1;
        } else {
          capturedItemsToQueue.push({
            id: transaction.id,
            sourcePackage: transaction.packageName,
            sourceAppName,
            combinedSources: transaction.combinedSources,
            sourceAlerts: transaction.sourceAlerts,
            title: transaction.title,
            rawText: transaction.text,
            amount: transaction.amount,
            direction: 'expense',
            isRefund: false,
            isTransfer: transaction.isTransfer,
            date,
            time,
            timestamp: ts,
            payee,
            categoryId,
            confidence: isHighConfidence ? 'high' : 'needs_review',
            confidenceReason: transaction.confidenceReason || (possibleDuplicateMatch ? 'Same amount and date as existing recorded expense' : catReason),
            upiRef: transaction.upiRef,
            accountLast4: transaction.accountLast4,
            status: 'pending',
            isPossibleDuplicate: transaction.isPossibleDuplicate || possibleDuplicateMatch,
            possibleDuplicateOf: transaction.possibleDuplicateOf,
          });
        }
      }
    }

    if (capturedItemsToQueue.length > 0) {
      queuedForReview = useCapturedStore.getState().addCapturedItems(capturedItemsToQueue);
    }

    // Two-phase drain: Acknowledge native queue so it can now safely remove processed IDs
    try {
      const idsToAck = list.map((t) => t.id).filter(Boolean);
      if (idsToAck.length > 0) {
        await TransactionCapture.ackTransactions({ ids: idsToAck });
      }
    } catch (err) {
      console.warn('ackTransactions failed; items will be safely deduplicated on next drain', err);
    }

    return { expenses, incomes, queuedForReview };
  },
};

/** Exact known invalid advertising templates that have no completed financial movement */
const EXACT_SPAM_AD_REGEX =
  /^\s*(?:get\s+₹?[0-9,]+\s+cashback\*\s+use\s+amazon\s+pay\s+upi[,\s]+for\s+amazon\s+shopping\.?|pay\s+[0-9]+\s*times\s+and\s+get\s+up\s+to\s+.*cashback|make\s+[0-9]+\s+upi\s+payments\s+and\s+get\s+upto\s+.*)\s*$/i;

/** Exact non-financial chat photo indicator */
const EXACT_CHAT_PHOTO_REGEX =
  /(?:📷|^\s*~?\s*[^:]*\b(?:📷\s*)?sent\s+[0-9]+\s+photos?\b|^\s*com\.whatsapp\b)/i;

/**
 * Checks whether a saved entry is a strong positive match to a known corrupted artifact.
 * Under NO circumstances does this delete legitimate purchases, real refunds, or genuine
 * transactions that contain promotional wording.
 */
export function isKnownInvalidRecord(notes: string): boolean {
  if (!notes) return false;
  const clean = notes.trim();

  // 1. Explicit WhatsApp chat media / photo counter artifact
  if (EXACT_CHAT_PHOTO_REGEX.test(clean)) {
    return true;
  }

  // 2. Exact match to a known marketing spam banner template that contains no debit/credit
  if (EXACT_SPAM_AD_REGEX.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Automatically purges ONLY positively identified corrupted entries:
 * 1. Bogus WhatsApp chat photo entries (containing '📷' or 'Sent X photos' without transaction).
 * 2. Exact known marketing advert templates (e.g. 'Get ₹50 Cashback* Use Amazon Pay UPI, for Amazon Shopping.').
 *
 * CRITICAL: Under no circumstances does this delete legitimate expenses based on amount, date,
 * or partial keywords like "for amazon shopping" or "cashback". Genuine refunds and cashback
 * purchases are strictly preserved. Actions are reversible via undoCleanup().
 */
export function cleanupCorruptedTransactions(): { removedExpenses: number; removedIncomes: number } {
  const expStore = useExpenseStore.getState();
  const incStore = useIncomeStore.getState();

  const removedExpList: Expense[] = [];
  const validExpenses = expStore.expenses.filter((e) => {
    if (isKnownInvalidRecord(e.notes || '')) {
      removedExpList.push(e);
      return false;
    }
    return true;
  });

  const removedIncList: Income[] = [];
  const validIncomes = incStore.incomes.filter((i) => {
    if (isKnownInvalidRecord(i.notes || '')) {
      removedIncList.push(i);
      return false;
    }
    return true;
  });

  if (removedExpList.length > 0) {
    expStore.setExpenses(validExpenses);
  }
  if (removedIncList.length > 0) {
    incStore.setIncomes(validIncomes);
  }

  // Backup for reversible undo
  if (removedExpList.length > 0 || removedIncList.length > 0) {
    useCapturedStore.getState().setCleanupBackup({
      expenses: removedExpList,
      incomes: removedIncList,
    });
  }

  return { removedExpenses: removedExpList.length, removedIncomes: removedIncList.length };
}

/**
 * Reverses the most recent cleanup operation, restoring any purged records.
 */
export function undoCleanup(): boolean {
  return useCapturedStore.getState().undoLastCleanup();
}



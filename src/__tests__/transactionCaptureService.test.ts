import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyNotification,
  correlateAndDeduplicate,
  maskSensitiveDetails,
  type RawNotificationItem,
} from '../services/transactionClassifier';
import {
  PROMO_REGEX,
  cleanupCorruptedTransactions,
  undoCleanup,
} from '../services/transactionCaptureService';
import {
  useCapturedStore,
  getTransactionIdentity,
  getNotificationIdentity,
  type CapturedTransactionItem,
} from '../stores/capturedTransactionStore';
import { suggestCategoryWithConfidence } from '../services/statementImportService';
import { useExpenseStore } from '../stores/expenseStore';
import { useIncomeStore } from '../stores/incomeStore';
import { useSettingsStore } from '../stores/settingsStore';
import {
  calculateTotalExpenses,
  calculateTotalIncome,
  calculateNetCashFlow,
  calculateCategoryTotals,
} from '../utils/calculations';
import type { Category } from '../types';

const mockCategories: Category[] = [
  { id: 'cat-food', name: 'Food & Dining', icon: '🍔', isDefault: true },
  { id: 'cat-shopping', name: 'Shopping', icon: '🛍️', isDefault: true },
  { id: 'cat-transport', name: 'Transportation', icon: '🚗', isDefault: true },
  { id: 'cat-bills', name: 'Bills & Utilities', icon: '💡', isDefault: true },
  { id: 'cat-other', name: 'Other', icon: '📦', isDefault: true },
];

describe('TransactionCapture & Classifier — Comprehensive Validation Suite', () => {
  beforeEach(() => {
    useExpenseStore.setState({ expenses: [] });
    useIncomeStore.setState({ incomes: [] });
    useCapturedStore.setState({ pendingItems: [], historyItems: [], processedSignatures: [] });
    useSettingsStore.setState({
      settings: {
        darkMode: false,
        currency: 'INR',
        categoryBudgets: {},
        merchantCategoryMap: {},
        autoImportHighConfidence: false,
      },
    });
  });

  describe('1. WhatsApp and Chat Messages Rejection', () => {
    it('strictly rejects WhatsApp chat messages with photo counters like "10 photos"', () => {
      const res = classifyNotification(
        'com.whatsapp',
        'Class 3(AI+CPS)Unofficial',
        '~ Tarun 📷 Sent 10 photos'
      );
      expect(res.outcome).toBe('chat_message');
      expect(res.confidence).toBe('rejected');
    });

    it('strictly rejects ordinary WhatsApp chat messages even if they mention ₹10 or money', () => {
      const res1 = classifyNotification('com.whatsapp', 'Rahul', 'Hey please send ₹10');
      expect(res1.outcome).toBe('chat_message');
      expect(res1.confidence).toBe('rejected');

      const res2 = classifyNotification('com.whatsapp', 'Mom', 'Paid ₹50 for vegetables');
      expect(res2.outcome).toBe('chat_message');
      expect(res2.confidence).toBe('rejected');
    });

    it('rejects SMS from personal non-bank sender even if it contains amount', () => {
      const res = classifyNotification(
        'com.google.android.apps.messaging',
        '+919876543210',
        'I received ₹500 from someone'
      );
      expect(res.outcome).toBe('chat_message');
      expect(res.confidence).toBe('rejected');
    });
  });

  describe('2. Promotional and Cashback Campaign Rejection', () => {
    it('detects and rejects "Pay 4 times and get up to ₹50 cashback"', () => {
      const text = 'Pay 4 times and get up to ₹50 cashback';
      const res = classifyNotification('net.one97.paytm', 'Paytm Offer', text);
      expect(res.outcome).toBe('promo_or_info');
      expect(res.confidence).toBe('rejected');
      expect(PROMO_REGEX.test(text)).toBe(true);
    });

    it('detects and rejects Amazon Pay cashback notifications', () => {
      const text = 'Get ₹50 Cashback* Use Amazon Pay UPI, for Amazon Shopping.';
      const res = classifyNotification('in.amazon.mShop.android.shopping', 'Amazon Pay', text);
      expect(res.outcome).toBe('promo_or_info');
      expect(res.confidence).toBe('rejected');
      expect(PROMO_REGEX.test(text)).toBe(true);
    });

    it('detects and rejects general reward campaigns, discounts, and pre-approved loans', () => {
      const res1 = classifyNotification('com.phonepe.app', 'PhonePe', 'Win up to ₹100 cashback on your next recharge');
      expect(res1.outcome).toBe('promo_or_info');

      const res2 = classifyNotification('net.one97.paytm', 'Paytm', 'Pre-approved personal loan of ₹2,00,000');
      expect(res2.outcome).toBe('promo_or_info');

      const res3 = classifyNotification('com.dreamplug.androidapp', 'CRED', 'Scratch card unlocked! Claim your reward');
      expect(res3.outcome).toBe('promo_or_info');
    });
  });

  describe('3. Payment Requests and Collect Requests', () => {
    it('classifies payment request or collect request as payment_request, never as an expense', () => {
      const res1 = classifyNotification('com.phonepe.app', 'PhonePe', 'Rahul has requested ₹500 via UPI');
      expect(res1.outcome).toBe('payment_request');
      expect(res1.confidence).toBe('rejected');

      const res2 = classifyNotification('net.one97.paytm', 'Paytm', 'Collect request of Rs. 250 from Merchant ABC');
      expect(res2.outcome).toBe('payment_request');
      expect(res2.confidence).toBe('rejected');
    });
  });

  describe('4. Pending, Failed, Declined, and Refund Payments', () => {
    it('rejects failed or declined payment alerts', () => {
      const res1 = classifyNotification('com.phonepe.app', 'PhonePe', 'Payment of ₹500 failed due to technical error');
      expect(res1.outcome).toBe('pending_or_failed');
      expect(res1.confidence).toBe('rejected');

      const res2 = classifyNotification('net.one97.paytm', 'Paytm', 'Transaction declined by bank for Rs. 200');
      expect(res2.outcome).toBe('pending_or_failed');
      expect(res2.confidence).toBe('rejected');
    });

    it('rejects timed out or pending payment alerts', () => {
      const res = classifyNotification('com.google.android.apps.nbu.paisa.user', 'Google Pay', 'Payment of ₹150 timed out');
      expect(res.outcome).toBe('pending_or_failed');
      expect(res.confidence).toBe('rejected');
    });

    it('classifies refund or reversal as refund_reversal (income with isRefund: true)', () => {
      const res = classifyNotification(
        'com.google.android.apps.messaging',
        'VM-HDFCBK-S',
        'Refund of ₹299 for order #4032 processed to your HDFC Bank A/c'
      );
      expect(res.outcome).toBe('refund_reversal');
      expect(res.confidence).toBe('high');
      expect(res.direction).toBe('income');
      expect(res.isRefund).toBe(true);
      expect(res.amount).toBe(299);
    });
  });

  describe('5. Real Completed UPI Debit', () => {
    it('accurately parses a real completed UPI debit as an expense', () => {
      const res = classifyNotification('com.phonepe.app', 'PhonePe', 'Paid ₹150 to Starbucks on UPI');
      expect(res.outcome).toBe('completed_debit');
      expect(res.confidence).toBe('high');
      expect(res.amount).toBe(150);
      expect(res.direction).toBe('expense');
      expect(res.payee).toBe('Starbucks');
    });

    it('parses bank debit notification while ignoring account number and remaining balance', () => {
      const text =
        'Rs. 1,450.00 debited from A/c XX1234 on 23-Oct-26 by UPI to SWIGGY. Avl Bal: Rs. 12,300 (UPI Ref 629635451517)';
      const res = classifyNotification('com.google.android.apps.messaging', 'VM-HDFCBK-S', text);

      expect(res.outcome).toBe('completed_debit');
      expect(res.confidence).toBe('high');
      expect(res.amount).toBe(1450); // NOT 1234 (account) and NOT 12300 (balance)
      expect(res.direction).toBe('expense');
      expect(res.payee).toBe('SWIGGY');
      expect(res.upiRef).toBe('629635451517');
      expect(res.accountLast4).toBe('1234');
    });
  });

  describe('6. Real Completed Credit (Income)', () => {
    it('accurately parses real completed ₹1 Slice credit into one income', () => {
      const text = 'Received ₹1 from MANISH KUMAR DHANKA Deposited in your HDFC Bank account.';
      const res = classifyNotification('indwin.c3.shareapp', 'Slice', text);

      expect(res.outcome).toBe('completed_credit');
      expect(res.confidence).toBe('high');
      expect(res.amount).toBe(1);
      expect(res.direction).toBe('income');
      expect(res.payee).toBe('MANISH KUMAR DHANKA');
    });
  });

  describe('7. Multi-Channel Deduplication (Slice + Bank SMS)', () => {
    it('combines same ₹1 credit reported by Slice and bank into ONE income with both sources associated when sharing reference', () => {
      const now = 1729700000000;
      const rawBatch: RawNotificationItem[] = [
        {
          id: 'slice-notif',
          packageName: 'indwin.c3.shareapp',
          title: 'Slice',
          text: 'Received ₹1 from MANISH KUMAR DHANKA Deposited in your HDFC Bank account. UPI Ref 629635451517',
          amount: 1,
          type: 'income',
          timestamp: now,
          upiRef: '629635451517',
        },
        {
          id: 'sms-notif',
          packageName: 'com.google.android.apps.messaging',
          title: 'VM-HDFCBK-S',
          text: 'Credit Alert! Rs.1.00 credited to HDFC Bank A/c XX0392 on 23-10-26 from VPA *0061@slc (UPI 629635451517)',
          amount: 1,
          type: 'income',
          timestamp: now + 3000,
          upiRef: '629635451517',
          accountLast4: '0392',
        },
      ];

      const deduped = correlateAndDeduplicate(rawBatch);

      // Must be collapsed into exactly 1 transaction
      expect(deduped).toHaveLength(1);
      expect(deduped[0].amount).toBe(1);
      expect(deduped[0].direction).toBe('income');

      // Both sources must be associated!
      expect(deduped[0].combinedSources).toContain('Slice');
      expect(deduped[0].combinedSources).toContain('HDFC Bank (SMS)');
      expect(deduped[0].sourceAppName).toContain('Slice');
      expect(deduped[0].sourceAppName).toContain('HDFC Bank (SMS)');
      expect(deduped[0].upiRef).toBe('629635451517');
      expect(deduped[0].sourceAlerts).toHaveLength(2);
      expect(deduped[0].sourceAlerts?.[0].timestamp).toBe(now);
      expect(deduped[0].sourceAlerts?.[1].timestamp).toBe(now + 3000);
    });

    it('flags same transaction reported by two apps without shared reference for review as possible duplicate', () => {
      const now = 1729700000000;
      const rawBatch: RawNotificationItem[] = [
        {
          id: 'slice-no-ref',
          packageName: 'indwin.c3.shareapp',
          title: 'Slice',
          text: 'Received ₹1 from MANISH KUMAR DHANKA Deposited in your HDFC Bank account.',
          amount: 1,
          type: 'income',
          timestamp: now,
        },
        {
          id: 'sms-no-ref',
          packageName: 'com.google.android.apps.messaging',
          title: 'VM-HDFCBK-S',
          text: 'Credit Alert! Rs.1.00 credited to HDFC Bank A/c XX0392 on 23-10-26 from VPA *0061@slc',
          amount: 1,
          type: 'income',
          timestamp: now + 3000,
          accountLast4: '0392',
        },
      ];

      const deduped = correlateAndDeduplicate(rawBatch);

      // Must NOT silently merge without shared reference or matching merchant!
      expect(deduped).toHaveLength(2);
      expect(deduped[0].amount).toBe(1);
      expect(deduped[1].amount).toBe(1);
      expect(deduped[0].isPossibleDuplicate).toBe(true);
      expect(deduped[1].isPossibleDuplicate).toBe(true);
      expect(deduped[0].confidence).toBe('needs_review');
      expect(deduped[1].confidence).toBe('needs_review');
      expect(deduped[0].sourceAlerts).toHaveLength(1);
      expect(deduped[1].sourceAlerts).toHaveLength(1);
    });

    it('keeps two separate completed ₹1 transactions at different times as TWO transactions', () => {
      const time1 = 1729700000000; // 10:00 AM
      const time2 = time1 + 30 * 60 * 1000; // 10:30 AM (30 mins later)

      const rawBatch: RawNotificationItem[] = [
        {
          id: 'pay-1',
          packageName: 'com.phonepe.app',
          title: 'PhonePe',
          text: 'Paid ₹1 to Chai Shop A on UPI',
          amount: 1,
          type: 'expense',
          timestamp: time1,
        },
        {
          id: 'pay-2',
          packageName: 'com.phonepe.app',
          title: 'PhonePe',
          text: 'Paid ₹1 to Chai Shop B on UPI',
          amount: 1,
          type: 'expense',
          timestamp: time2,
        },
      ];

      const deduped = correlateAndDeduplicate(rawBatch);

      // Must remain 2 distinct transactions!
      expect(deduped).toHaveLength(2);
      expect(deduped[0].amount).toBe(1);
      expect(deduped[1].amount).toBe(1);
      expect(deduped[0].payee).toBe('Chai Shop A');
      expect(deduped[1].payee).toBe('Chai Shop B');
    });
  });

  describe('8. Notifications with Multiple Amounts and Ambiguity', () => {
    it('routes notification with multiple conflicting transactional amounts to review', () => {
      const text = 'Paid ₹500 to Store ABC and ₹50 added to wallet';
      const res = classifyNotification('net.one97.paytm', 'Paytm', text);

      expect(res.outcome).toBe('ambiguous_review');
      expect(res.confidence).toBe('needs_review');
      expect(res.reason).toContain('Multiple');
    });
  });

  describe('9. Idempotency & Repeat Deliveries Across App Restarts', () => {
    it('prevents duplicate review items when notification is delivered repeatedly', () => {
      const item: CapturedTransactionItem = {
        id: 'dup-test-1',
        sourcePackage: 'com.phonepe.app',
        sourceAppName: 'PhonePe',
        title: 'PhonePe',
        rawText: 'Paid ₹100 to Uber',
        amount: 100,
        direction: 'expense',
        date: '2026-10-23',
        time: '12:00',
        timestamp: Date.now(),
        payee: 'Uber',
        categoryId: 'cat-transport',
        confidence: 'high',
        status: 'pending',
      };

      const count1 = useCapturedStore.getState().addCapturedItems([item]);
      expect(count1).toBe(1);
      expect(useCapturedStore.getState().pendingItems).toHaveLength(1);

      // Re-delivery of the exact same notification
      const count2 = useCapturedStore.getState().addCapturedItems([item]);
      expect(count2).toBe(0); // Ignored
      expect(useCapturedStore.getState().pendingItems).toHaveLength(1);

      // Approve item
      useCapturedStore.getState().approveItem('dup-test-1');
      expect(useCapturedStore.getState().pendingItems).toHaveLength(0);

      // Re-delivery after approval
      const count3 = useCapturedStore.getState().addCapturedItems([item]);
      expect(count3).toBe(0); // Signature check prevents re-queueing
      expect(useCapturedStore.getState().pendingItems).toHaveLength(0);
    });
  });

  describe('10. cleanupCorruptedTransactions', () => {
    it('purges existing Amazon Pay cashback promotional expense from store', () => {
      const nowIso = new Date().toISOString();
      useExpenseStore.setState({
        expenses: [
          {
            id: 'amazon-promo-exp',
            amount: 50,
            categoryId: 'cat-shopping',
            date: '2026-10-23',
            paymentMethod: 'UPI',
            notes: 'Get ₹50 Cashback* Use Amazon Pay UPI, for Amazon Shopping.',
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: 'real-exp',
            amount: 1,
            categoryId: 'cat-other',
            date: '2026-10-23',
            paymentMethod: 'UPI',
            notes: 'slice ₹1 debited from your slice account',
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ],
      });

      const { removedExpenses } = cleanupCorruptedTransactions();
      expect(removedExpenses).toBe(1);

      const remaining = useExpenseStore.getState().expenses;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('real-exp');
      expect(remaining[0].amount).toBe(1);
    });

    it('purges existing bogus WhatsApp chat photo expenses and leaves valid expenses', () => {
      const nowIso = new Date().toISOString();
      useExpenseStore.setState({
        expenses: [
          {
            id: 'bogus-1',
            amount: 10,
            categoryId: 'cat-other',
            date: '2026-10-23',
            paymentMethod: 'UPI',
            notes: 'Class 3(AI+CPS)Unofficial: ~ Tarun 📷 Sent 10 photos',
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: 'valid-1',
            amount: 150,
            categoryId: 'cat-food',
            date: '2026-10-23',
            paymentMethod: 'UPI',
            notes: 'Paid ₹150 to Dominos',
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ],
      });

      const { removedExpenses } = cleanupCorruptedTransactions();
      expect(removedExpenses).toBe(1);

      const remaining = useExpenseStore.getState().expenses;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('valid-1');
      expect(remaining[0].amount).toBe(150);
    });
  });

  describe('11. Category Suggestion & Learned Merchant Preference', () => {
    it('assigns high confidence for well-known merchants', () => {
      const res = suggestCategoryWithConfidence('Swiggy', mockCategories);
      expect(res.confidence).toBe('high');
      expect(res.categoryId).toBe('cat-food');
    });

    it('assigns "needs_review" for ambiguous or unknown payees', () => {
      const res = suggestCategoryWithConfidence('UNKNOWN_MERCHANT_123', mockCategories);
      expect(res.confidence).toBe('needs_review');
    });

    it('uses learned merchant mappings with high confidence', () => {
      const merchantMap = { 'sharma dairy': 'cat-food' };
      const res = suggestCategoryWithConfidence('Sharma Dairy', mockCategories, merchantMap);
      expect(res.confidence).toBe('high');
      expect(res.categoryId).toBe('cat-food');
      expect(res.reason).toContain('remembered merchant');
    });
  });

  describe('12. Review Queue Actions & Idempotency', () => {
    it('allows approving captured items and saves merchant preference', () => {
      const sampleItem: CapturedTransactionItem = {
        id: 'cap-item-1',
        sourcePackage: 'com.phonepe.app',
        sourceAppName: 'PhonePe',
        title: 'PhonePe',
        rawText: 'Paid ₹200 to Chai Point on UPI',
        amount: 200,
        direction: 'expense',
        date: '2026-10-23',
        time: '12:00',
        timestamp: Date.now(),
        payee: 'Chai Point',
        categoryId: 'cat-food',
        confidence: 'high',
        status: 'pending',
      };

      useCapturedStore.setState({ pendingItems: [sampleItem], historyItems: [], processedSignatures: [] });

      const ok = useCapturedStore.getState().approveItem('cap-item-1', true);
      expect(ok).toBe(true);

      expect(useCapturedStore.getState().pendingItems).toHaveLength(0);
      expect(useCapturedStore.getState().historyItems).toHaveLength(1);

      const expenses = useExpenseStore.getState().expenses;
      expect(expenses).toHaveLength(1);
      expect(expenses[0].amount).toBe(200);

      const savedMap = useSettingsStore.getState().settings.merchantCategoryMap;
      expect(savedMap?.['chai point']).toBe('cat-food');
    });

    it('allows dismissing unwanted captured alerts', () => {
      const sampleItem: CapturedTransactionItem = {
        id: 'cap-item-2',
        sourcePackage: 'indwin.c3.shareapp',
        sourceAppName: 'Slice',
        title: 'Slice',
        rawText: 'Test notification',
        amount: 10,
        direction: 'expense',
        date: '2026-10-23',
        time: '12:05',
        timestamp: Date.now(),
        payee: 'Test',
        categoryId: 'cat-other',
        confidence: 'needs_review',
        status: 'pending',
      };

      useCapturedStore.setState({ pendingItems: [sampleItem], historyItems: [], processedSignatures: [] });
      useCapturedStore.getState().dismissItem('cap-item-2');

      expect(useCapturedStore.getState().pendingItems).toHaveLength(0);
      expect(useExpenseStore.getState().expenses).toHaveLength(0);
    });

    it('allows batch approval of high confidence items', () => {
      const itemHigh: CapturedTransactionItem = {
        id: 'high-1',
        sourcePackage: 'com.phonepe.app',
        sourceAppName: 'PhonePe',
        title: 'PhonePe',
        rawText: 'Paid ₹100 to Uber',
        amount: 100,
        direction: 'expense',
        date: '2026-10-23',
        time: '12:10',
        timestamp: Date.now(),
        payee: 'Uber',
        categoryId: 'cat-transport',
        confidence: 'high',
        status: 'pending',
      };

      const itemReview: CapturedTransactionItem = {
        id: 'review-1',
        sourcePackage: 'net.one97.paytm',
        sourceAppName: 'Paytm',
        title: 'Paytm',
        rawText: 'Paid ₹50 to Unknown Payee',
        amount: 50,
        direction: 'expense',
        date: '2026-10-23',
        time: '12:15',
        timestamp: Date.now(),
        payee: 'Unknown Payee',
        categoryId: 'cat-other',
        confidence: 'needs_review',
        status: 'pending',
      };

      useCapturedStore.setState({ pendingItems: [itemHigh, itemReview], historyItems: [], processedSignatures: [] });

      const approvedCount = useCapturedStore.getState().approveAllHighConfidence();
      expect(approvedCount).toBe(1);

      expect(useCapturedStore.getState().pendingItems).toHaveLength(1);
      expect(useCapturedStore.getState().pendingItems[0].id).toBe('review-1');
      expect(useExpenseStore.getState().expenses).toHaveLength(1);
    });
  });

  describe('13. Safe Cross-App Deduplication Regressions (Priority 1)', () => {
    const baseTime = 1729700000000;

    it('Same amount, same merchant, same reference across two apps: deduplicate', () => {
      const rawBatch: RawNotificationItem[] = [
        {
          id: 'app-a',
          packageName: 'com.phonepe.app',
          title: 'PhonePe',
          text: 'Paid ₹250 to Chai Point on UPI Ref: 987654321012',
          amount: 250,
          type: 'expense',
          timestamp: baseTime,
          upiRef: '987654321012',
        },
        {
          id: 'app-b',
          packageName: 'com.google.android.apps.messaging',
          title: 'VM-HDFCBK-S',
          text: 'Debited Rs.250.00 from HDFC Bank A/c XX0392 for Chai Point (UPI 987654321012)',
          amount: 250,
          type: 'expense',
          timestamp: baseTime + 4000,
          upiRef: '987654321012',
        },
      ];

      const deduped = correlateAndDeduplicate(rawBatch);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].amount).toBe(250);
      expect(deduped[0].payee).toBe('Chai Point');
      expect(deduped[0].upiRef).toBe('987654321012');
      expect(deduped[0].combinedSources).toContain('PhonePe');
      expect(deduped[0].combinedSources).toContain('HDFC Bank (SMS)');
      expect(deduped[0].isPossibleDuplicate).toBe(false);
    });

    it('Same amount and time, different merchants: keep both as separate transactions', () => {
      const rawBatch: RawNotificationItem[] = [
        {
          id: 'pay-starbucks',
          packageName: 'com.phonepe.app',
          title: 'PhonePe',
          text: 'Paid ₹200 to Starbucks on UPI',
          amount: 200,
          type: 'expense',
          timestamp: baseTime,
        },
        {
          id: 'pay-uber',
          packageName: 'com.google.android.apps.nbu.paisa.user',
          title: 'Google Pay',
          text: 'Paid ₹200 to Uber via GPay',
          amount: 200,
          type: 'expense',
          timestamp: baseTime + 10000, // 10 seconds later
        },
      ];

      const deduped = correlateAndDeduplicate(rawBatch);
      expect(deduped).toHaveLength(2);
      expect(deduped[0].amount).toBe(200);
      expect(deduped[1].amount).toBe(200);
      expect(deduped.map((d) => d.payee)).toEqual(expect.arrayContaining(['Starbucks', 'Uber']));
      expect(deduped[0].isPossibleDuplicate).toBe(false);
      expect(deduped[1].isPossibleDuplicate).toBe(false);
    });

    it('Same amount and time, no merchant or shared reference: ask for review; do not silently merge', () => {
      const rawBatch: RawNotificationItem[] = [
        {
          id: 'alert-1',
          packageName: 'net.one97.paytm',
          title: 'Paytm',
          text: 'Paid ₹150 from your wallet/account',
          amount: 150,
          type: 'expense',
          timestamp: baseTime,
        },
        {
          id: 'alert-2',
          packageName: 'com.phonepe.app',
          title: 'PhonePe',
          text: 'Debited ₹150 on UPI',
          amount: 150,
          type: 'expense',
          timestamp: baseTime + 15000,
        },
      ];

      const deduped = correlateAndDeduplicate(rawBatch);
      // Insufficient evidence: must preserve BOTH alerts!
      expect(deduped).toHaveLength(2);
      expect(deduped[0].amount).toBe(150);
      expect(deduped[1].amount).toBe(150);

      // Both must be flagged for review as possible duplicates
      expect(deduped[0].isPossibleDuplicate).toBe(true);
      expect(deduped[1].isPossibleDuplicate).toBe(true);
      expect(deduped[0].confidence).toBe('needs_review');
      expect(deduped[1].confidence).toBe('needs_review');
    });

    it('Two distinct same-amount payments within five minutes: preserve both', () => {
      const rawBatch: RawNotificationItem[] = [
        {
          id: 'coffee-order-1',
          packageName: 'com.phonepe.app',
          title: 'PhonePe',
          text: 'Paid ₹50 to Raju Tea Stall on UPI',
          amount: 50,
          type: 'expense',
          timestamp: baseTime,
        },
        {
          id: 'groceries-order-2',
          packageName: 'com.phonepe.app',
          title: 'PhonePe',
          text: 'Paid ₹50 to Sharma Groceries on UPI',
          amount: 50,
          type: 'expense',
          timestamp: baseTime + 2 * 60 * 1000, // 2 mins later
        },
      ];

      const deduped = correlateAndDeduplicate(rawBatch);
      expect(deduped).toHaveLength(2);
      expect(deduped[0].amount).toBe(50);
      expect(deduped[1].amount).toBe(50);
      expect(deduped[0].payee).toBe('Raju Tea Stall');
      expect(deduped[1].payee).toBe('Sharma Groceries');
      expect(deduped[0].isPossibleDuplicate).toBe(false);
      expect(deduped[1].isPossibleDuplicate).toBe(false);
    });

    it('Repeated delivery of the exact same notification: do not create a duplicate', () => {
      const item: CapturedTransactionItem = {
        id: 'repeat-notif-1',
        sourcePackage: 'com.phonepe.app',
        sourceAppName: 'PhonePe',
        title: 'PhonePe',
        rawText: 'Paid ₹300 to Swiggy on UPI Ref 112233445566',
        amount: 300,
        direction: 'expense',
        date: '2026-10-23',
        time: '14:00',
        timestamp: baseTime,
        payee: 'Swiggy',
        categoryId: 'cat-food',
        confidence: 'high',
        status: 'pending',
        upiRef: '112233445566',
      };

      const addedFirst = useCapturedStore.getState().addCapturedItems([item]);
      expect(addedFirst).toBe(1);
      expect(useCapturedStore.getState().pendingItems).toHaveLength(1);

      // Re-delivery of identical notification
      const addedSecond = useCapturedStore.getState().addCapturedItems([item]);
      expect(addedSecond).toBe(0);
      expect(useCapturedStore.getState().pendingItems).toHaveLength(1);
    });

    it('Same reference with slightly different notification wording: deduplicate', () => {
      const rawBatch: RawNotificationItem[] = [
        {
          id: 'paytm-wording-1',
          packageName: 'net.one97.paytm',
          title: 'Paytm',
          text: 'Paid Rs.400 to Flipkart on UPI. Ref: 554433221100',
          amount: 400,
          type: 'expense',
          timestamp: baseTime,
          upiRef: '554433221100',
        },
        {
          id: 'bank-wording-2',
          packageName: 'com.google.android.apps.messaging',
          title: 'VK-AXISBK-T',
          text: 'Rs 400.00 debited from Axis A/c XX9988 for FLIPKART (UPI Ref 554433221100)',
          amount: 400,
          type: 'expense',
          timestamp: baseTime + 5000,
          upiRef: '554433221100',
        },
      ];

      const deduped = correlateAndDeduplicate(rawBatch);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].amount).toBe(400);
      expect(deduped[0].upiRef).toBe('554433221100');
      expect(deduped[0].combinedSources).toContain('Paytm');
      expect(deduped[0].combinedSources).toContain('Axis Bank (SMS)');
    });
  });

  describe('14. Safe Cleanup Non-Destructive Behavior & Reversible Undo', () => {
    it('does NOT delete legitimate expenses with identical amounts created within 15 minutes', () => {
      const nowIso = new Date().toISOString();
      const legitimate1 = {
        id: 'order-1',
        amount: 250,
        categoryId: 'cat-food',
        date: '2026-10-23',
        paymentMethod: 'UPI' as const,
        notes: 'Paid ₹250 to Dominos',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const legitimate2 = {
        id: 'order-2',
        amount: 250,
        categoryId: 'cat-food',
        date: '2026-10-23',
        paymentMethod: 'UPI' as const,
        notes: 'Paid ₹250 to Pizza Hut',
        createdAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };
      const promoBogus = {
        id: 'promo-1',
        amount: 50,
        categoryId: 'cat-shopping',
        date: '2026-10-23',
        paymentMethod: 'UPI' as const,
        notes: 'Get ₹50 Cashback* Use Amazon Pay UPI, for Amazon Shopping.',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      useExpenseStore.setState({ expenses: [legitimate1, legitimate2, promoBogus] });

      const { removedExpenses } = cleanupCorruptedTransactions();
      // Only the promo must be deleted; both legitimate ₹250 payments MUST be kept!
      expect(removedExpenses).toBe(1);

      const remaining = useExpenseStore.getState().expenses;
      expect(remaining).toHaveLength(2);
      expect(remaining.map((e) => e.id)).toEqual(['order-1', 'order-2']);
      expect(remaining[0].amount).toBe(250);
      expect(remaining[1].amount).toBe(250);
    });

    it('allows undoing cleanup to restore purged records', () => {
      const nowIso = new Date().toISOString();
      const promoBogus = {
        id: 'promo-undo-test',
        amount: 50,
        categoryId: 'cat-shopping',
        date: '2026-10-23',
        paymentMethod: 'UPI' as const,
        notes: 'Get ₹50 Cashback* Use Amazon Pay UPI, for Amazon Shopping.',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      useExpenseStore.setState({ expenses: [promoBogus] });
      cleanupCorruptedTransactions();
      expect(useExpenseStore.getState().expenses).toHaveLength(0);

      // Undo cleanup
      const ok = undoCleanup();
      expect(ok).toBe(true);
      expect(useExpenseStore.getState().expenses).toHaveLength(1);
      expect(useExpenseStore.getState().expenses[0].id).toBe('promo-undo-test');
    });
  });

  describe('15. Privacy & Sensitive Details Masking', () => {
    it('masks 16-digit card numbers, bank account numbers, and OTPs in raw notification text', () => {
      const raw = 'Debited Rs.500 from Card 4111 2222 3333 4444 and A/c 123456789012. Use OTP 849201 to authenticate.';
      const masked = maskSensitiveDetails(raw);

      expect(masked).not.toContain('4111 2222 3333 4444');
      expect(masked).toContain('**** **** **** 4444');

      expect(masked).not.toContain('123456789012');
      expect(masked).toContain('******9012');

      expect(masked).not.toContain('849201');
      expect(masked).toContain('OTP: ******');
    });
  });

  describe('16. Transaction Identity & Idempotency Detailed Audits', () => {
    it('handles two same-amount payments to same merchant on same day at different times without collision', () => {
      const morningTime = 1729677600000; // 10:00 AM
      const afternoonTime = 1729695600000; // 03:00 PM

      const item1: CapturedTransactionItem = {
        id: 'notif-tea-1',
        sourcePackage: 'com.phonepe.app',
        sourceAppName: 'PhonePe',
        title: 'PhonePe',
        rawText: 'Paid ₹50 to Raju Tea Stall',
        amount: 50,
        direction: 'expense',
        date: '2026-10-23',
        time: '10:00',
        timestamp: morningTime,
        payee: 'Raju Tea Stall',
        categoryId: 'cat-food',
        confidence: 'high',
        status: 'pending',
      };

      const item2: CapturedTransactionItem = {
        id: 'notif-tea-2',
        sourcePackage: 'com.phonepe.app',
        sourceAppName: 'PhonePe',
        title: 'PhonePe',
        rawText: 'Paid ₹50 to Raju Tea Stall',
        amount: 50,
        direction: 'expense',
        date: '2026-10-23',
        time: '15:00',
        timestamp: afternoonTime,
        payee: 'Raju Tea Stall',
        categoryId: 'cat-food',
        confidence: 'high',
        status: 'pending',
      };

      // Verify notification and transaction identity separation
      expect(getNotificationIdentity(item1)).toBe('notif-tea-1');
      expect(getNotificationIdentity(item2)).toBe('notif-tea-2');

      // Verify that unreferenced transaction identities are distinct and incorporate timestamps/id
      const id1 = getTransactionIdentity(item1);
      const id2 = getTransactionIdentity(item2);
      expect(id1).not.toBe(id2);

      // Add both to review store
      const addedCount = useCapturedStore.getState().addCapturedItems([item1, item2]);
      expect(addedCount).toBe(2);

      // Both must be preserved in pending queue
      const pending = useCapturedStore.getState().pendingItems;
      expect(pending).toHaveLength(2);
      expect(pending.map((p) => p.id)).toEqual(expect.arrayContaining(['notif-tea-1', 'notif-tea-2']));
    });

    it('detects re-delivery of the exact same notification and ignores it', () => {
      const item: CapturedTransactionItem = {
        id: 'notif-exact-redelivery',
        sourcePackage: 'com.google.android.apps.nbu.paisa.user',
        sourceAppName: 'Google Pay',
        title: 'Google Pay',
        rawText: 'Paid ₹120 to Metro on UPI',
        amount: 120,
        direction: 'expense',
        date: '2026-10-23',
        time: '11:00',
        timestamp: Date.now(),
        payee: 'Metro',
        categoryId: 'cat-transport',
        confidence: 'high',
        status: 'pending',
      };

      // First delivery
      const count1 = useCapturedStore.getState().addCapturedItems([item]);
      expect(count1).toBe(1);
      expect(useCapturedStore.getState().pendingItems).toHaveLength(1);

      // Re-delivery while pending
      const count2 = useCapturedStore.getState().addCapturedItems([item]);
      expect(count2).toBe(0);
      expect(useCapturedStore.getState().pendingItems).toHaveLength(1);

      // Approve item
      useCapturedStore.getState().approveItem('notif-exact-redelivery');
      expect(useCapturedStore.getState().pendingItems).toHaveLength(0);
      expect(useExpenseStore.getState().expenses).toHaveLength(1);

      // Re-delivery after approval
      const count3 = useCapturedStore.getState().addCapturedItems([item]);
      expect(count3).toBe(0);
      expect(useCapturedStore.getState().pendingItems).toHaveLength(0);
      expect(useExpenseStore.getState().expenses).toHaveLength(1);
    });

    it('auto-merges same transaction reported by two apps with a shared reference', () => {
      const now = 1729700000000;
      const rawBatch: RawNotificationItem[] = [
        {
          id: 'phonepe-alert',
          packageName: 'com.phonepe.app',
          title: 'PhonePe',
          text: 'Paid ₹350 to Chai Point on UPI Ref: 987654321098',
          amount: 350,
          type: 'expense',
          timestamp: now,
          upiRef: '987654321098',
        },
        {
          id: 'bank-alert',
          packageName: 'com.google.android.apps.messaging',
          title: 'VM-HDFCBK-S',
          text: 'Debited Rs.350.00 from HDFC Bank A/c XX0392 for Chai Point (UPI 987654321098)',
          amount: 350,
          type: 'expense',
          timestamp: now + 2000,
          upiRef: '987654321098',
          accountLast4: '0392',
        },
      ];

      const deduped = correlateAndDeduplicate(rawBatch);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].amount).toBe(350);
      expect(deduped[0].payee).toBe('Chai Point');
      expect(deduped[0].upiRef).toBe('987654321098');
      expect(deduped[0].combinedSources).toEqual(expect.arrayContaining(['PhonePe', 'HDFC Bank (SMS)']));
      expect(deduped[0].sourceAlerts).toHaveLength(2);
      expect(deduped[0].isPossibleDuplicate).toBe(false);
    });

    it('keeps separate and flags for review same transaction reported by two apps without a shared reference', () => {
      const now = 1729700000000;
      const rawBatch: RawNotificationItem[] = [
        {
          id: 'paytm-no-ref',
          packageName: 'net.one97.paytm',
          title: 'Paytm',
          text: 'Paid ₹350 from your account',
          amount: 350,
          type: 'expense',
          timestamp: now,
        },
        {
          id: 'phonepe-no-ref',
          packageName: 'com.phonepe.app',
          title: 'PhonePe',
          text: 'Debited ₹350 on UPI',
          amount: 350,
          type: 'expense',
          timestamp: now + 5000,
        },
      ];

      const deduped = correlateAndDeduplicate(rawBatch);
      // Because there is no shared reference and no matching merchant name, do NOT silently merge!
      expect(deduped).toHaveLength(2);
      expect(deduped[0].isPossibleDuplicate).toBe(true);
      expect(deduped[1].isPossibleDuplicate).toBe(true);
      expect(deduped[0].confidence).toBe('needs_review');
      expect(deduped[1].confidence).toBe('needs_review');
      expect(deduped[0].sourceAlerts).toHaveLength(1);
      expect(deduped[1].sourceAlerts).toHaveLength(1);
    });

    it('keeps two unrelated transactions with the same account suffix and amount separate', () => {
      const now = 1729700000000;
      const rawBatch: RawNotificationItem[] = [
        {
          id: 'uber-tx',
          packageName: 'com.google.android.apps.messaging',
          title: 'VM-HDFCBK-S',
          text: 'Debited Rs.500.00 from HDFC Bank A/c XX1234 to UBER on 23-10-26',
          amount: 500,
          type: 'expense',
          timestamp: now,
          accountLast4: '1234',
        },
        {
          id: 'bms-tx',
          packageName: 'com.google.android.apps.messaging',
          title: 'VM-HDFCBK-S',
          text: 'Debited Rs.500.00 from HDFC Bank A/c XX1234 to BOOKMYSHOW on 23-10-26',
          amount: 500,
          type: 'expense',
          timestamp: now + 60000, // 1 min later
          accountLast4: '1234',
        },
      ];

      const deduped = correlateAndDeduplicate(rawBatch);
      // Must NOT merge! Distinct merchants (Uber vs BookMyShow)
      expect(deduped).toHaveLength(2);
      expect(deduped[0].amount).toBe(500);
      expect(deduped[1].amount).toBe(500);
      expect(deduped[0].payee).toBe('UBER');
      expect(deduped[1].payee).toBe('BOOKMYSHOW');
      expect(deduped[0].isPossibleDuplicate).toBe(false);
      expect(deduped[1].isPossibleDuplicate).toBe(false);
    });

    it('prevents re-import of already recorded transactions after app restart', () => {
      const nowIso = new Date().toISOString();
      // Pre-existing expense in store with UPI reference
      useExpenseStore.setState({
        expenses: [
          {
            id: 'saved-exp-1',
            amount: 250,
            categoryId: 'cat-food',
            date: '2026-10-23',
            paymentMethod: 'UPI',
            notes: 'Paid ₹250 to Swiggy (UPI Ref 776655443322)',
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ],
      });

      const incomingBatch: CapturedTransactionItem[] = [
        {
          id: 'incoming-duplicate',
          sourcePackage: 'com.phonepe.app',
          sourceAppName: 'PhonePe',
          title: 'PhonePe',
          rawText: 'Paid ₹250 to Swiggy on UPI Ref: 776655443322',
          amount: 250,
          direction: 'expense',
          date: '2026-10-23',
          time: '12:00',
          timestamp: Date.now(),
          payee: 'Swiggy',
          categoryId: 'cat-food',
          confidence: 'high',
          status: 'pending',
          upiRef: '776655443322',
        },
        {
          id: 'incoming-new',
          sourcePackage: 'com.phonepe.app',
          sourceAppName: 'PhonePe',
          title: 'PhonePe',
          rawText: 'Paid ₹99 to Spotify on UPI Ref: 111122223333',
          amount: 99,
          direction: 'expense',
          date: '2026-10-23',
          time: '12:05',
          timestamp: Date.now(),
          payee: 'Spotify',
          categoryId: 'cat-bills',
          confidence: 'high',
          status: 'pending',
          upiRef: '111122223333',
        },
      ];

      // Mark the first transaction as already processed via transaction identity
      const txId1 = getTransactionIdentity(incomingBatch[0]);
      useCapturedStore.setState({
        processedTransactionIds: [txId1],
        pendingItems: [],
        seenNotificationIds: [],
      });

      const added = useCapturedStore.getState().addCapturedItems(incomingBatch);
      // Only the new transaction is added
      expect(added).toBe(1);
      expect(useCapturedStore.getState().pendingItems).toHaveLength(1);
      expect(useCapturedStore.getState().pendingItems[0].id).toBe('incoming-new');
    });
  });

  describe('17. Conservative Duplicate Correlation & Source Preservation', () => {
    const baseTime = 1729700000000;

    it('merges same merchant, same direction, same reference within five minutes', () => {
      const rawBatch: RawNotificationItem[] = [
        {
          id: 'm-1',
          packageName: 'com.phonepe.app',
          title: 'PhonePe',
          text: 'Paid ₹200 to Swiggy on UPI Ref 888777666',
          amount: 200,
          type: 'expense',
          timestamp: baseTime,
          upiRef: '888777666',
        },
        {
          id: 'm-2',
          packageName: 'com.google.android.apps.messaging',
          title: 'VM-HDFCBK-S',
          text: 'Debited Rs.200 for SWIGGY (UPI 888777666)',
          amount: 200,
          type: 'expense',
          timestamp: baseTime + 2000,
          upiRef: '888777666',
        },
      ];

      const deduped = correlateAndDeduplicate(rawBatch);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].amount).toBe(200);
      expect(deduped[0].payee).toBe('Swiggy');
      expect(deduped[0].combinedSources).toHaveLength(2);
      expect(deduped[0].sourceAlerts).toHaveLength(2);
      expect(deduped[0].isPossibleDuplicate).toBe(false);
    });

    it('keeps separate different merchants with same amount within five minutes', () => {
      const rawBatch: RawNotificationItem[] = [
        {
          id: 'diff-1',
          packageName: 'com.phonepe.app',
          title: 'PhonePe',
          text: 'Paid ₹400 to Flipkart on UPI',
          amount: 400,
          type: 'expense',
          timestamp: baseTime,
        },
        {
          id: 'diff-2',
          packageName: 'com.google.android.apps.nbu.paisa.user',
          title: 'Google Pay',
          text: 'Paid ₹400 to Amazon via GPay',
          amount: 400,
          type: 'expense',
          timestamp: baseTime + 15000,
        },
      ];

      const deduped = correlateAndDeduplicate(rawBatch);
      expect(deduped).toHaveLength(2);
      expect(deduped.map((d) => d.payee)).toEqual(expect.arrayContaining(['Flipkart', 'Amazon']));
      expect(deduped[0].isPossibleDuplicate).toBe(false);
      expect(deduped[1].isPossibleDuplicate).toBe(false);
    });

    it('puts in review without silently merging when no shared reference and weak merchant evidence', () => {
      const rawBatch: RawNotificationItem[] = [
        {
          id: 'weak-1',
          packageName: 'net.one97.paytm',
          title: 'Paytm',
          text: 'Debited ₹150 from HDFC Bank',
          amount: 150,
          type: 'expense',
          timestamp: baseTime,
        },
        {
          id: 'weak-2',
          packageName: 'com.phonepe.app',
          title: 'PhonePe',
          text: 'Paid ₹150 on UPI',
          amount: 150,
          type: 'expense',
          timestamp: baseTime + 10000,
        },
      ];

      const deduped = correlateAndDeduplicate(rawBatch);
      expect(deduped).toHaveLength(2);
      expect(deduped[0].isPossibleDuplicate).toBe(true);
      expect(deduped[1].isPossibleDuplicate).toBe(true);
      expect(deduped[0].confidence).toBe('needs_review');
      expect(deduped[1].confidence).toBe('needs_review');
    });

    it('preserves two genuine payments close together unless strong shared identity proves duplication', () => {
      const rawBatch: RawNotificationItem[] = [
        {
          id: 'coffee-1',
          packageName: 'com.phonepe.app',
          title: 'PhonePe',
          text: 'Paid ₹100 to Chai Point on UPI Ref 111111',
          amount: 100,
          type: 'expense',
          timestamp: baseTime,
          upiRef: '111111',
        },
        {
          id: 'coffee-2',
          packageName: 'com.phonepe.app',
          title: 'PhonePe',
          text: 'Paid ₹100 to Chai Point on UPI Ref 222222',
          amount: 100,
          type: 'expense',
          timestamp: baseTime + 60000, // 1 min later
          upiRef: '222222',
        },
      ];

      const deduped = correlateAndDeduplicate(rawBatch);
      expect(deduped).toHaveLength(2);
      expect(deduped[0].upiRef).toBe('111111');
      expect(deduped[1].upiRef).toBe('222222');
      expect(deduped[0].isPossibleDuplicate).toBe(false);
      expect(deduped[1].isPossibleDuplicate).toBe(false);
    });

    it('ensures source association retains original notifications and timestamps in sourceAlerts', () => {
      const time1 = baseTime;
      const time2 = baseTime + 3500;

      const rawBatch: RawNotificationItem[] = [
        {
          id: 'src-assoc-1',
          packageName: 'com.phonepe.app',
          title: 'PhonePe',
          text: 'Paid ₹500 to Reliance Digital on UPI Ref 990011',
          amount: 500,
          type: 'expense',
          timestamp: time1,
          upiRef: '990011',
        },
        {
          id: 'src-assoc-2',
          packageName: 'com.google.android.apps.messaging',
          title: 'VK-AXISBK-T',
          text: 'Debited Rs.500.00 from Axis A/c XX5678 for Reliance Digital (UPI 990011)',
          amount: 500,
          type: 'expense',
          timestamp: time2,
          upiRef: '990011',
          accountLast4: '5678',
        },
      ];

      const deduped = correlateAndDeduplicate(rawBatch);
      expect(deduped).toHaveLength(1);
      const mergedItem = deduped[0];

      expect(mergedItem.sourceAlerts).toBeDefined();
      expect(mergedItem.sourceAlerts).toHaveLength(2);

      // Verify original notifications and timestamps are completely intact
      expect(mergedItem.sourceAlerts![0].sourceApp).toBe('PhonePe');
      expect(mergedItem.sourceAlerts![0].timestamp).toBe(time1);
      expect(mergedItem.sourceAlerts![0].text).toContain('Reliance Digital');

      expect(mergedItem.sourceAlerts![1].sourceApp).toBe('Axis Bank (SMS)');
      expect(mergedItem.sourceAlerts![1].timestamp).toBe(time2);
      expect(mergedItem.sourceAlerts![1].text).toContain('Axis A/c XX5678');
    });
  });

  describe('18. Financial Totals for Debit, Credit, Refund, Reversal, and Transfer', () => {
    it('handles reversed failed payment so it does NOT count as both expense and income (net 0)', () => {
      const nowIso = new Date().toISOString();
      // Step 1: Initial failed payment recorded as an expense
      useExpenseStore.setState({
        expenses: [
          {
            id: 'failed-exp-1',
            amount: 750,
            categoryId: 'cat-food',
            date: '2026-10-23',
            paymentMethod: 'UPI',
            notes: 'Paid ₹750 to Zomato UPI Ref 555666777',
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ],
      });

      // Before reversal: total expenses = 750, income = 0
      expect(calculateTotalExpenses(useExpenseStore.getState().expenses)).toBe(750);
      expect(calculateTotalIncome(useIncomeStore.getState().incomes)).toBe(0);

      // Step 2: Reversal notification arrives
      const reversalItem: CapturedTransactionItem = {
        id: 'rev-notif-1',
        sourcePackage: 'com.google.android.apps.messaging',
        sourceAppName: 'HDFC Bank (SMS)',
        title: 'VM-HDFCBK-S',
        rawText: 'Reversal: Rs.750.00 credited back to HDFC Bank A/c for failed payment UPI 555666777',
        amount: 750,
        direction: 'income',
        isRefund: true,
        isReversal: true,
        linkedExpenseId: 'failed-exp-1',
        date: '2026-10-23',
        time: '12:30',
        timestamp: Date.now(),
        payee: 'Zomato Reversal',
        categoryId: 'cat-food',
        confidence: 'high',
        status: 'pending',
        upiRef: '555666777',
      };

      useCapturedStore.setState({ pendingItems: [reversalItem], historyItems: [] });

      // Approve reversal
      const approved = useCapturedStore.getState().approveItem('rev-notif-1');
      expect(approved).toBe(true);

      const expenses = useExpenseStore.getState().expenses;
      const incomes = useIncomeStore.getState().incomes;

      // Verify expense is marked isReversed: true
      expect(expenses[0].isReversed).toBe(true);
      // Verify income is recorded with isReversal: true
      expect(incomes[0].isReversal).toBe(true);

      // Financial totals verification:
      // Total expenses must NOT include reversed payment
      const netExpenses = calculateTotalExpenses(expenses);
      expect(netExpenses).toBe(0);

      // Total income must NOT count reversal as new income
      const netIncome = calculateTotalIncome(incomes);
      expect(netIncome).toBe(0);

      // Net cash flow must be 0
      expect(calculateNetCashFlow(netIncome, netExpenses)).toBe(0);
    });

    it('correctly modifies financial totals when a purchase refund is linked to an expense', () => {
      const nowIso = new Date().toISOString();
      useExpenseStore.setState({
        expenses: [
          {
            id: 'cloth-exp-1',
            amount: 2000,
            categoryId: 'cat-shopping',
            date: '2026-10-23',
            paymentMethod: 'UPI',
            notes: 'Paid ₹2000 to Myntra',
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ],
      });

      const refundItem: CapturedTransactionItem = {
        id: 'refund-notif-1',
        sourcePackage: 'com.google.android.apps.messaging',
        sourceAppName: 'HDFC Bank (SMS)',
        title: 'VM-HDFCBK-S',
        rawText: 'Refund of Rs.600.00 processed from Myntra to your HDFC Bank A/c',
        amount: 600,
        direction: 'income',
        isRefund: true,
        isReversal: false,
        linkedExpenseId: 'cloth-exp-1',
        date: '2026-10-23',
        time: '14:00',
        timestamp: Date.now(),
        payee: 'Myntra Refund',
        categoryId: 'cat-shopping',
        confidence: 'high',
        status: 'pending',
      };

      useCapturedStore.setState({ pendingItems: [refundItem], historyItems: [] });
      useCapturedStore.getState().approveItem('refund-notif-1');

      const expenses = useExpenseStore.getState().expenses;
      const incomes = useIncomeStore.getState().incomes;

      // Expense refundedAmount is updated to 600
      expect(expenses[0].refundedAmount).toBe(600);

      // Net expenses should now be 2000 - 600 = 1400
      const netExpenses = calculateTotalExpenses(expenses);
      expect(netExpenses).toBe(1400);

      // Income does NOT count the linked refund as new income (it already offset expenses)
      const netIncome = calculateTotalIncome(incomes);
      expect(netIncome).toBe(0);

      // Category total for Shopping should reflect net 1400
      const catTotals = calculateCategoryTotals(expenses, mockCategories);
      const shoppingCat = catTotals.find((c) => c.id === 'cat-shopping');
      expect(shoppingCat?.amount).toBe(1400);
    });

    it('handles internal transfers without labeling them as spending or income (net 0)', () => {
      // User transfers ₹10,000 from SBI savings to HDFC savings
      const transferOutItem: CapturedTransactionItem = {
        id: 'xfer-out',
        sourcePackage: 'com.google.android.apps.messaging',
        sourceAppName: 'SBI (SMS)',
        title: 'SBI',
        rawText: 'Debited Rs.10,000.00 from SBI A/c XX1111 transfer to HDFC A/c XX2222',
        amount: 10000,
        direction: 'expense',
        isTransfer: true,
        date: '2026-10-23',
        time: '16:00',
        timestamp: Date.now(),
        payee: 'Self / Internal Transfer',
        categoryId: 'cat-other',
        confidence: 'needs_review',
        status: 'pending',
      };

      const transferInItem: CapturedTransactionItem = {
        id: 'xfer-in',
        sourcePackage: 'com.google.android.apps.messaging',
        sourceAppName: 'HDFC Bank (SMS)',
        title: 'HDFC Bank',
        rawText: 'Credited Rs.10,000.00 to HDFC A/c XX2222 from SBI A/c XX1111',
        amount: 10000,
        direction: 'income',
        isTransfer: true,
        date: '2026-10-23',
        time: '16:00',
        timestamp: Date.now(),
        payee: 'Self / Internal Transfer',
        categoryId: 'cat-other',
        confidence: 'needs_review',
        status: 'pending',
      };

      useCapturedStore.setState({ pendingItems: [transferOutItem, transferInItem], historyItems: [] });

      // Approve both sides of the transfer
      useCapturedStore.getState().approveItem('xfer-out');
      useCapturedStore.getState().approveItem('xfer-in');

      const expenses = useExpenseStore.getState().expenses;
      const incomes = useIncomeStore.getState().incomes;

      expect(expenses).toHaveLength(1);
      expect(expenses[0].isTransfer).toBe(true);

      expect(incomes).toHaveLength(1);
      expect(incomes[0].isTransfer).toBe(true);

      // Financial totals verification:
      // Transfers must NOT be counted as expense spending
      expect(calculateTotalExpenses(expenses)).toBe(0);

      // Transfers must NOT be counted as income
      expect(calculateTotalIncome(incomes)).toBe(0);

      // Net cash flow must remain unaffected (0)
      expect(calculateNetCashFlow(calculateTotalIncome(incomes), calculateTotalExpenses(expenses))).toBe(0);

      // Transfers must NOT pollute category spending budgets
      const catTotals = calculateCategoryTotals(expenses, mockCategories);
      expect(catTotals).toHaveLength(0);
    });

    it('puts unlinked or ambiguous refund in review rather than guessing an association', () => {
      const refundText = 'Refund of ₹499 processed to your account';
      const classified = classifyNotification('com.google.android.apps.messaging', 'Bank Alert', refundText);

      expect(classified.outcome).toBe('refund_reversal');
      expect(classified.isRefund).toBe(true);

      // Without matching previous expense, approving it creates standalone income without modifying random expenses
      const standaloneRefundItem: CapturedTransactionItem = {
        id: 'unlinked-refund',
        sourcePackage: 'com.google.android.apps.messaging',
        sourceAppName: 'Bank Alert',
        title: 'Bank Alert',
        rawText: refundText,
        amount: 499,
        direction: 'income',
        isRefund: true,
        date: '2026-10-23',
        time: '18:00',
        timestamp: Date.now(),
        payee: 'Refund',
        categoryId: 'cat-other',
        confidence: 'needs_review',
        confidenceReason: 'Unlinked refund',
        status: 'pending',
      };

      useCapturedStore.setState({ pendingItems: [standaloneRefundItem], historyItems: [] });
      useCapturedStore.getState().approveItem('unlinked-refund');

      const expenses = useExpenseStore.getState().expenses;
      const incomes = useIncomeStore.getState().incomes;

      expect(expenses).toHaveLength(0); // No expense corrupted
      expect(incomes).toHaveLength(1);
      expect(incomes[0].amount).toBe(499);
      expect(incomes[0].linkedExpenseId).toBeUndefined();
    });
  });

  describe('19. Safe Cleanup Guardrails & Legitimate Transaction Protection', () => {
    it('does NOT purge legitimate cashback-related purchases', () => {
      const nowIso = new Date().toISOString();
      const legitimateCashbackPurchase = {
        id: 'cashback-purchase-1',
        amount: 399,
        categoryId: 'cat-food',
        date: '2026-10-23',
        paymentMethod: 'UPI' as const,
        notes: "Paid ₹399 to Domino's Pizza. Eligible for 10% cashback up to ₹50",
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      useExpenseStore.setState({ expenses: [legitimateCashbackPurchase] });
      const { removedExpenses } = cleanupCorruptedTransactions();

      expect(removedExpenses).toBe(0);
      expect(useExpenseStore.getState().expenses).toHaveLength(1);
      expect(useExpenseStore.getState().expenses[0].id).toBe('cashback-purchase-1');
    });

    it('does NOT purge real refunds', () => {
      const nowIso = new Date().toISOString();
      const legitimateRefund = {
        id: 'refund-inc-1',
        amount: 450,
        source: 'Refund',
        date: '2026-10-23',
        notes: 'Refund of ₹450 for order #8890 processed to HDFC Bank A/c',
        isRecurring: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      useIncomeStore.setState({ incomes: [legitimateRefund] });
      const { removedIncomes } = cleanupCorruptedTransactions();

      expect(removedIncomes).toBe(0);
      expect(useIncomeStore.getState().incomes).toHaveLength(1);
      expect(useIncomeStore.getState().incomes[0].id).toBe('refund-inc-1');
    });

    it('does NOT purge genuine transactions with promotional wording (e.g. promo code used)', () => {
      const nowIso = new Date().toISOString();
      const promoCodedExpense = {
        id: 'promo-code-exp-1',
        amount: 240,
        categoryId: 'cat-food',
        date: '2026-10-23',
        paymentMethod: 'UPI' as const,
        notes: 'Paid ₹240 to Swiggy using discount promo code HUNGRY50',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      useExpenseStore.setState({ expenses: [promoCodedExpense] });
      const { removedExpenses } = cleanupCorruptedTransactions();

      expect(removedExpenses).toBe(0);
      expect(useExpenseStore.getState().expenses).toHaveLength(1);
      expect(useExpenseStore.getState().expenses[0].id).toBe('promo-code-exp-1');
    });

    it('strictly purges ONLY known corrupted records and allows full undo restoration', () => {
      const nowIso = new Date().toISOString();
      const corruptedItem = {
        id: 'bogus-photo-chat',
        amount: 10,
        categoryId: 'cat-other',
        date: '2026-10-23',
        paymentMethod: 'UPI' as const,
        notes: 'Class 3(AI+CPS)Unofficial: ~ Tarun 📷 Sent 10 photos',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const realItem = {
        id: 'valid-food-exp',
        amount: 180,
        categoryId: 'cat-food',
        date: '2026-10-23',
        paymentMethod: 'UPI' as const,
        notes: 'Paid ₹180 to Haldirams',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      useExpenseStore.setState({ expenses: [corruptedItem, realItem] });

      const { removedExpenses } = cleanupCorruptedTransactions();
      expect(removedExpenses).toBe(1);

      // Corrupted removed, real preserved
      expect(useExpenseStore.getState().expenses).toHaveLength(1);
      expect(useExpenseStore.getState().expenses[0].id).toBe('valid-food-exp');

      // Undo cleanup
      const restored = undoCleanup();
      expect(restored).toBe(true);
      expect(useExpenseStore.getState().expenses).toHaveLength(2);
      expect(useExpenseStore.getState().expenses.map((e) => e.id)).toEqual(
        expect.arrayContaining(['bogus-photo-chat', 'valid-food-exp'])
      );
    });
  });

  describe('20. Classifier Parity & Queue Reliability', () => {
    it('verifies classifier parity across representative test fixtures', () => {
      // 1. Obvious marketing offer without financial movement -> rejected
      const promoRes = classifyNotification(
        'net.one97.paytm',
        'Paytm Offer',
        'Special offer! Get up to ₹100 cashback on your mobile recharge today'
      );
      expect(promoRes.confidence).toBe('rejected');
      expect(promoRes.outcome).toBe('promo_or_info');

      // 2. Chat message -> rejected
      const chatRes = classifyNotification(
        'com.whatsapp',
        'School Group',
        '~ Teacher: Please submit the homework'
      );
      expect(chatRes.confidence).toBe('rejected');
      expect(chatRes.outcome).toBe('chat_message');

      // 3. Payment collect request -> rejected
      const requestRes = classifyNotification(
        'com.phonepe.app',
        'PhonePe',
        'Rahul has requested ₹500 via UPI'
      );
      expect(requestRes.confidence).toBe('rejected');
      expect(requestRes.outcome).toBe('payment_request');

      // 4. Failed payment -> rejected
      const failedRes = classifyNotification(
        'com.google.android.apps.nbu.paisa.user',
        'Google Pay',
        'Payment of ₹350 to BigBasket failed'
      );
      expect(failedRes.confidence).toBe('rejected');
      expect(failedRes.outcome).toBe('pending_or_failed');

      // 5. Real debit with promotional scratch card reward attached -> MUST be kept as debit!
      const debitWithReward = classifyNotification(
        'com.google.android.apps.nbu.paisa.user',
        'Google Pay',
        'Paid ₹150 to Swiggy. You won a scratch card!'
      );
      expect(debitWithReward.outcome).toBe('completed_debit');
      expect(debitWithReward.confidence).toBe('high');
      expect(debitWithReward.amount).toBe(150);
      expect(debitWithReward.payee).toBe('Swiggy');

      // 6. Bank debit alert with balance and account number -> extracts only the debit amount
      const bankDebit = classifyNotification(
        'com.google.android.apps.messaging',
        'VM-HDFCBK-S',
        'Rs. 2,150.00 debited from A/c XX4321 to AMAZON on 23-10-26. Avl Bal: Rs. 45,000'
      );
      expect(bankDebit.outcome).toBe('completed_debit');
      expect(bankDebit.amount).toBe(2150); // NOT 4321 and NOT 45000
      expect(bankDebit.accountLast4).toBe('4321');
      expect(bankDebit.payee).toBe('AMAZON');

      // 7. Completed credit alert -> classifies as completed_credit
      const bankCredit = classifyNotification(
        'com.google.android.apps.messaging',
        'VM-HDFCBK-S',
        'Credit Alert! Rs.5,000.00 credited to HDFC Bank A/c XX4321 on 23-10-26 (UPI Ref 123456789012)'
      );
      expect(bankCredit.outcome).toBe('completed_credit');
      expect(bankCredit.amount).toBe(5000);
      expect(bankCredit.direction).toBe('income');
      expect(bankCredit.upiRef).toBe('123456789012');

      // 8. Internal transfer alert -> classifies as internal_transfer
      const xferAlert = classifyNotification(
        'com.google.android.apps.messaging',
        'VM-HDFCBK-S',
        'Transferred Rs. 10,000.00 to self account XX9999 from SBI'
      );
      expect(xferAlert.outcome).toBe('internal_transfer');
      expect(xferAlert.isTransfer).toBe(true);
      expect(xferAlert.amount).toBe(10000);
    });

    it('ensures queue draining is recoverable and safe across restarts without losing records or creating duplicates', () => {
      const item1: CapturedTransactionItem = {
        id: 'q-item-1',
        sourcePackage: 'com.phonepe.app',
        sourceAppName: 'PhonePe',
        title: 'PhonePe',
        rawText: 'Paid ₹100 to Uber',
        amount: 100,
        direction: 'expense',
        date: '2026-10-23',
        time: '19:00',
        timestamp: Date.now(),
        payee: 'Uber',
        categoryId: 'cat-transport',
        confidence: 'high',
        status: 'pending',
      };

      const item2: CapturedTransactionItem = {
        id: 'q-item-2',
        sourcePackage: 'com.phonepe.app',
        sourceAppName: 'PhonePe',
        title: 'PhonePe',
        rawText: 'Paid ₹200 to Starbucks',
        amount: 200,
        direction: 'expense',
        date: '2026-10-23',
        time: '19:05',
        timestamp: Date.now() + 1000,
        payee: 'Starbucks',
        categoryId: 'cat-food',
        confidence: 'high',
        status: 'pending',
      };

      // Phase 1: Drain 2 items into review store
      const added = useCapturedStore.getState().addCapturedItems([item1, item2]);
      expect(added).toBe(2);
      expect(useCapturedStore.getState().pendingItems).toHaveLength(2);

      // Phase 2: Simulate service restart or repeated delivery of the same native batch
      // Native queue should only be acknowledged after items are safely persisted in app store.
      // If service re-sends the same batch:
      const reAdded = useCapturedStore.getState().addCapturedItems([item1, item2]);
      expect(reAdded).toBe(0); // 0 added, no duplicates created
      expect(useCapturedStore.getState().pendingItems).toHaveLength(2); // Queue remains exactly 2
    });
  });
});


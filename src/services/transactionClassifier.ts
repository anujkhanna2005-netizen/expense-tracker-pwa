/**
 * Structured Transaction Classifier and Cross-App Deduplication Pipeline
 *
 * Implements an explainable classification pipeline that prevents false positives
 * from chat messages, promotional campaigns, reward offers, payment requests,
 * failed/pending attempts, and multi-channel duplicate notifications.
 *
 * Deduplication Evidence Order:
 * 1. Shared stable reference (UPI Ref / RRN / UTR).
 * 2. Conservative match: same direction, exact amount, time <= 5 min, compatible app, AND matching merchant.
 * 3. Insufficient evidence: keep BOTH alerts visible for review, labeled "Possible duplicate". Never merge on amount/time alone.
 */

export type ClassificationOutcome =
  | 'completed_debit'
  | 'completed_credit'
  | 'refund_reversal'
  | 'internal_transfer'
  | 'promo_or_info'
  | 'chat_message'
  | 'payment_request'
  | 'pending_or_failed'
  | 'ambiguous_review';

export interface ClassificationResult {
  outcome: ClassificationOutcome;
  confidence: 'high' | 'needs_review' | 'rejected';
  reason: string;
  amount?: number;
  direction?: 'expense' | 'income' | 'transfer';
  isRefund?: boolean;
  isReversal?: boolean;
  isTransfer?: boolean;
  linkedExpenseId?: string;
  payee?: string;
  upiRef?: string;
  accountLast4?: string;
  candidateAmounts?: number[];
  cleanText?: string;
}

export interface RawNotificationItem {
  id: string;
  packageName: string;
  title: string;
  text: string;
  timestamp: number;
  amount?: number;
  type?: 'expense' | 'income' | 'transfer';
  upiRef?: string;
  accountLast4?: string;
}

export interface SourceAlertInfo {
  sourceApp: string;
  packageName: string;
  title: string;
  text: string;
  timestamp: number;
  upiRef?: string;
  accountLast4?: string;
}

export interface DeduplicatedTransaction {
  id: string;
  packageName: string;
  sourceAppName: string;
  combinedSources: string[];
  sourceAlerts?: SourceAlertInfo[];
  title: string;
  text: string;
  amount: number;
  direction: 'expense' | 'income' | 'transfer';
  isRefund: boolean;
  isReversal?: boolean;
  isTransfer?: boolean;
  linkedExpenseId?: string;
  timestamp: number;
  payee: string;
  upiRef?: string;
  accountLast4?: string;
  confidence: 'high' | 'needs_review';
  confidenceReason: string;
  outcome: ClassificationOutcome;
  isPossibleDuplicate?: boolean;
  possibleDuplicateOf?: string;
}

// 1. Non-banking / Chat Applications to strictly reject
const CHAT_PACKAGES = new Set([
  'com.whatsapp',
  'com.whatsapp.w4b',
  'org.telegram.messenger',
  'com.facebook.orca',
  'com.instagram.android',
  'com.snapchat.android',
  'com.discord',
  'com.slack',
  'com.viber.voip',
  'com.skype.raider',
  'org.thoughtcrime.securesms', // Signal
]);

// 2. Known SMS packages delivering bank alerts
const SMS_PACKAGES = new Set([
  'com.google.android.apps.messaging',
  'com.samsung.android.messaging',
  'com.android.mms',
  'com.truecaller',
  'com.coloros.mms',
  'com.oneplus.mms',
  'com.vivo.mms',
]);

// 3. Known Indian bank sender abbreviations (TRAI alphanumeric sender format)
const BANK_SMS_SENDER_REGEX =
  /(?:bank|hdfc|sbi|icici|axis|kotak|pnb|bob|idfc|canara|indus|rbl|yesb|fed|paytm|upi|slice|cred|citi|scb|hsbc|baroda|unionb|central|mahabank)/i;

// 4. Marketing, promotional, cashback, discount, loan, and bill reminder patterns
export const PROMO_CAMPAIGN_REGEX =
  /(?:\bpay\s+[0-9]+\s*(?:times|upi\s+payments?)\b|\bget\s*(?:up\s*to|upto)?\s*(?:rs\.?|₹|inr)?\s*[0-9,]+\s*cashback\b|\b(?:cashback\*?|cash back\*?)\b|\bscratch card\b|\breward\b|\bbonus\b|\bcoupon\b|\bvoucher\b|\bdiscount\b|\b%\s*off\b|\bflat\s*(?:rs\.?|₹|inr)\s*[0-9,]+\s*off\b|\bwin\s*(?:up\s*to|upto|rs\.?|₹|inr|cashback)\b|\bearn\s*(?:up\s*to|upto|rs\.?|₹|inr|cashback)\b|\bchance to win\b|\blucky winner\b|\buse\s+(?:amazon\s*pay|paytm|phonepe|gpay|google\s*pay)\s+upi\b|\bfor\s+amazon\s*shopping\b|\bpay\s+with\s+amazon\s*pay\b|\bexclusive offer\b|\blimited-?time\b|\beligible\b|\boffer valid\b|\bterms\s+apply\b|\bt&c\s+apply\b|\byou\s+(?:can|could|will|are eligible to)\s+(?:earn|win|receive|get)\b|\bpre-?approved\b|\binstant loan\b|\bpersonal loan\b|\bcredit score\b|\bcibil\b|\b(?:bill is due|bill due|due date|due on|upcoming bill|bill generated|reminder:|payment reminder)\b)/i;

// Pure promotional, loan, and reminder patterns that never contain completed financial movements
const PURE_PROMO_REGEX =
  /(?:\bpre-?approved\b|\binstant loan\b|\bpersonal loan\b|\bcredit score\b|\bcibil\b|\b(?:bill is due|bill due|due date|due on|upcoming bill|bill generated|reminder:|payment reminder)\b|\bpay\s+[0-9]+\s*(?:times|upi\s+payments?)\b|\bpay\s+(?:via|using|with)\s+upi\s+and\s+(?:get|win|earn)\b|\buse\s+(?:amazon\s*pay|paytm|phonepe|gpay|google\s*pay)\s+upi\b|\bfor\s+amazon\s*shopping\b|\bpay\s+with\s+amazon\s*pay\b|\bstand a chance\b|\blucky winner\b|\bchance to win\b|\bspin & win\b|\bspin the wheel\b|\brefer(?:ral)?\b|\binvite friends?\b)/i;

// 5. Payment requests and collect requests (not debits!)
const PAYMENT_REQUEST_REGEX =
  /(?:\bhas requested\b|\brequested money\b|\bpayment request\b|\bcollect request\b|\brequest from\b|\bsplit bill\b|\bpay request\b|\brequested\s*(?:rs\.?|₹|inr)?\s*[0-9,]+)/i;

// 6. Pending, failed, declined, or timed out payment attempts
const PENDING_OR_FAILED_REGEX =
  /(?:\bfailed\b|\bdeclined\b|\bunsuccessful\b|\btimed out\b|\bcould not process\b|\bcancelled\b|\bcanceled\b|\bpayment pending\b|\btxn pending\b|\bpending payment\b|\bin progress\b|\bprocessing payment\b)/i;

// 7. Chat media indicators (e.g., "Tarun 📷 Sent 10 photos")
const CHAT_MEDIA_REGEX =
  /(?:📷|\b[0-9]+\s*(?:photos?|images?|videos?|files?|audios?|messages?|contacts?|documents?|attachments?)\b)/i;

// Internal transfers between user's own accounts
const TRANSFER_REGEX =
  /(?:\btransferred\s+to\s+(?:self|own\s+account|own\s+a\/c)\b|\bself\s+transfer\b|\btransfer\s+to\s+self\b|\bto\s+own\s+a\/c\b|\bfrom\s+own\s+a\/c\b|\btransfer\s+(?:between|across)\s+(?:your\s+)?accounts\b|\bto\s+self\b)/i;

// Payment reversals
const REVERSAL_REGEX =
  /(?:\breversal(?:\s+of)?\b|\breversed\b|\bpayment\s+reversed\b|\bfailed\s+txn\s+reversed\b)/i;

// 8. UPI reference number pattern
const UPI_REF_REGEX =
  /(?:upi(?:[\s\-_/]*ref(?:[\s\-_/]*(?:no|id))?|\/)?|rrn|txn\s*id|utr|ref(?:[\s\-_/]*no)?)\s*[:#\s/\-]?\s*([0-9]{9,16})\b/i;

// 9. Account number pattern
const ACCOUNT_LAST4_REGEX =
  /(?:a\/c|acct|account|card)\s*(?:no\.?)?\s*(?:ending\s*(?:in|with)?|xx+)?\s*([0-9]{3,4})\b/i;

// 10. Available balance pattern (to strip from text before amount parsing)
const BALANCE_REGEX =
  /(?:avl\.?\s*bal(?:ance)?|avail(?:able)?\s*bal(?:ance)?|a\/c\s*bal(?:ance)?|account\s*balance|bal(?:ance)?\s*[:\-]|avail(?:able)?\s*limit)\s*[:\-]?\s*(?:rs\.?|₹|inr)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi;

// 11. Transaction Direction Phrases (Requiring concrete currency indicators)
const DEBIT_CONCRETE_REGEX =
  /(?:debited(?:\s+(?:with|by|for|of))?|paid(?:\s+to)?|spent|sent|transferred|withdrawn|charged|deducted|payment of|txn of|successful(?:\s+payment)?(?:\s+of)?)\s*[:\-]?\s*(?:rs\.?|₹|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)|(?:rs\.?|₹|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:is|has been)?\s*(?:successfully\s+)?(?:debited|paid|spent|sent|transferred|withdrawn|charged|deducted)|(?:debit alert!|money sent\s*[:\-])\s*(?:rs\.?|₹|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i;

const CREDIT_CONCRETE_REGEX =
  /(?:credited(?:\s+(?:with|by|of))?|received|got|deposited|payment received(?:\s+of)?|money received(?:\s*[:\-])?|added(?:\s+to\s+(?:your\s+)?(?:account|wallet))?)\s*[:\-]?\s*(?:rs\.?|₹|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)|(?:rs\.?|₹|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:is|has been)?\s*(?:successfully\s+)?(?:credited|deposited|received)|(?:credit alert!|money received\s*[:\-])\s*(?:rs\.?|₹|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i;

const REFUND_CONCRETE_REGEX =
  /(?:refund(?:ed)?(?:\s+of)?|reversal(?:\s+of)?|reversed)\s*[:\-]?\s*(?:rs\.?|₹|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)|(?:rs\.?|₹|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:is|has been)?\s*(?:successfully\s+)?(?:refunded|reversed)/i;

/**
 * Redacts sensitive numbers (card numbers, full account numbers) from text.
 */
export function maskSensitiveDetails(text: string): string {
  if (!text) return '';
  return text
    .replace(/\b\d{4}([ -]?)\d{4}\1\d{4}\1(\d{4})\b/g, (_m, sep, last4) => {
      const s = sep || ' ';
      return `****${s}****${s}****${s}${last4}`;
    })
    .replace(/(?:a\/c|account)[\s:]*([0-9]{5,18})/gi, (_m, acct) => {
      const last4 = acct.slice(-4);
      return `A/c ******${last4}`;
    })
    .replace(/\b(?:otp|code|pin)[\s:]*([0-9]{4,8})\b/gi, 'OTP: ******');
}

/**
 * Classifies a single notification through an explainable, multi-step pipeline.
 */
export function classifyNotification(
  packageName: string,
  title: string,
  text: string
): ClassificationResult {
  const normPackage = (packageName || '').trim().toLowerCase();
  const cleanTitle = (title || '').trim();
  const cleanText = (text || '').trim();
  const fullText = `${cleanTitle} ${cleanText}`.replace(/\s+/g, ' ');

  // ── Step 1: Package Identity & Non-Banking Chat App Exclusion ──
  if (CHAT_PACKAGES.has(normPackage) || normPackage.includes('whatsapp') || normPackage.includes('telegram')) {
    return {
      outcome: 'chat_message',
      confidence: 'rejected',
      reason: 'Ordinary chat message from personal messaging app (e.g. WhatsApp)',
    };
  }

  // If received via SMS app, verify it is from a legitimate bank / UPI header
  if (SMS_PACKAGES.has(normPackage)) {
    const isBankSender =
      BANK_SMS_SENDER_REGEX.test(cleanTitle) ||
      /\b(?:a\/c|acct|vpa|card ending|upi ref|rrn|imps|neft|rtgs)\b/i.test(fullText);

    if (!isBankSender) {
      return {
        outcome: 'chat_message',
        confidence: 'rejected',
        reason: 'Personal SMS from non-banking sender',
      };
    }
  }

  // ── Step 2: Chat Media / Photo Count Check ──
  if (CHAT_MEDIA_REGEX.test(fullText)) {
    return {
      outcome: 'chat_message',
      confidence: 'rejected',
      reason: 'Chat media counter (e.g. "Sent 10 photos")',
    };
  }

  // ── Step 3: Payment Requests and Collect Requests ──
  if (PAYMENT_REQUEST_REGEX.test(fullText)) {
    return {
      outcome: 'payment_request',
      confidence: 'rejected',
      reason: 'Payment or collect request (not a completed debit)',
    };
  }

  // ── Step 4: Pending, Failed, or Declined Payments ──
  if (PENDING_OR_FAILED_REGEX.test(fullText)) {
    return {
      outcome: 'pending_or_failed',
      confidence: 'rejected',
      reason: 'Payment failed, declined, timed out, or pending completion',
    };
  }

  // ── Step 5: Pure Promotional Campaigns without completed transaction ──
  if (PURE_PROMO_REGEX.test(fullText)) {
    // Check if there is also an explicit completed debit or credit
    const textWithoutBalanceTemp = fullText.replace(BALANCE_REGEX, ' [BAL_STRIPPED] ');
    const hasDebit = DEBIT_CONCRETE_REGEX.test(textWithoutBalanceTemp);
    const hasCredit = CREDIT_CONCRETE_REGEX.test(textWithoutBalanceTemp);
    const hasRefund = REFUND_CONCRETE_REGEX.test(textWithoutBalanceTemp);

    if (!hasDebit && !hasCredit && !hasRefund) {
      return {
        outcome: 'promo_or_info',
        confidence: 'rejected',
        reason: 'Cashback offer, loan offer, or promotional advert',
      };
    }
  }

  // ── Step 6: Metadata Extraction (UPI Ref, Account Last 4, Balances) ──
  let upiRef: string | undefined;
  const upiMatch = fullText.match(UPI_REF_REGEX);
  if (upiMatch && upiMatch[1]) {
    upiRef = upiMatch[1];
  }

  let accountLast4: string | undefined;
  const acctMatch = fullText.match(ACCOUNT_LAST4_REGEX);
  if (acctMatch && acctMatch[1]) {
    accountLast4 = acctMatch[1];
  }

  // Strip available balances and limits to prevent false amount capture
  const textWithoutBalance = fullText.replace(BALANCE_REGEX, ' [BAL_STRIPPED] ');

  // ── Step 7: Detect Direction & Extract Candidate Transaction Amount ──
  let direction: 'expense' | 'income' | 'transfer' | undefined;
  let isRefund = false;
  let isReversal = false;
  let isTransfer = false;
  let candidateAmount: number | undefined;

  // 7A: Check Internal Transfer between own accounts
  if (TRANSFER_REGEX.test(textWithoutBalance)) {
    isTransfer = true;
    direction = 'transfer';
    const debitM = textWithoutBalance.match(DEBIT_CONCRETE_REGEX);
    const creditM = textWithoutBalance.match(CREDIT_CONCRETE_REGEX);
    if (debitM) {
      const rawAmt = debitM[1] || debitM[2] || debitM[3];
      if (rawAmt) candidateAmount = parseFloat(rawAmt.replace(/,/g, ''));
    } else if (creditM) {
      const rawAmt = creditM[1] || creditM[2] || creditM[3];
      if (rawAmt) candidateAmount = parseFloat(rawAmt.replace(/,/g, ''));
    }
  }

  // 7B: Check Reversal of payment
  if (!candidateAmount && REVERSAL_REGEX.test(textWithoutBalance)) {
    const revMatch = textWithoutBalance.match(REFUND_CONCRETE_REGEX);
    if (revMatch) {
      const rawAmt = revMatch[1] || revMatch[2];
      if (rawAmt) {
        candidateAmount = parseFloat(rawAmt.replace(/,/g, ''));
        direction = 'income';
        isRefund = true;
        isReversal = true;
      }
    }
  }

  // 7C: Check Refund
  if (!candidateAmount) {
    const refundMatch = textWithoutBalance.match(REFUND_CONCRETE_REGEX);
    if (refundMatch) {
      const rawAmt = refundMatch[1] || refundMatch[2];
      if (rawAmt) {
        candidateAmount = parseFloat(rawAmt.replace(/,/g, ''));
        direction = 'income';
        isRefund = true;
      }
    }
  }

  // 7D: Check Completed Credit (Income)
  if (!candidateAmount) {
    const creditMatch = textWithoutBalance.match(CREDIT_CONCRETE_REGEX);
    if (creditMatch) {
      const rawAmt = creditMatch[1] || creditMatch[2] || creditMatch[3];
      if (rawAmt) {
        candidateAmount = parseFloat(rawAmt.replace(/,/g, ''));
        direction = 'income';
      }
    }
  }

  // 7E: Check Completed Debit (Expense)
  if (!candidateAmount) {
    const debitMatch = textWithoutBalance.match(DEBIT_CONCRETE_REGEX);
    if (debitMatch) {
      const rawAmt = debitMatch[1] || debitMatch[2] || debitMatch[3];
      if (rawAmt) {
        candidateAmount = parseFloat(rawAmt.replace(/,/g, ''));
        direction = 'expense';
      }
    }
  }

  // If candidate amount is still missing and text matches promo regex, reject as promo
  if (!candidateAmount && PROMO_CAMPAIGN_REGEX.test(fullText)) {
    return {
      outcome: 'promo_or_info',
      confidence: 'rejected',
      reason: 'Cashback offer, reward campaign, or promotional advert',
    };
  }

  // ── Step 8: Multi-Amount Ambiguity Check ──
  const allCurrencies = [...textWithoutBalance.matchAll(/(?:rs\.?|₹|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi)];
  const extractedAmounts = allCurrencies
    .map((m) => parseFloat(m[1].replace(/,/g, '')))
    .filter((a) => !isNaN(a) && a > 0);

  const uniqueAmounts = Array.from(new Set(extractedAmounts));

  // If candidate amount is missing or <= 0
  if (!candidateAmount || candidateAmount <= 0) {
    if (uniqueAmounts.length > 0) {
      return {
        outcome: 'ambiguous_review',
        confidence: 'needs_review',
        reason: 'Monetary amount found but completion or direction context is unclear',
        amount: uniqueAmounts[0],
        candidateAmounts: uniqueAmounts,
        upiRef,
        accountLast4,
        cleanText: fullText,
      };
    }
    return {
      outcome: 'ambiguous_review',
      confidence: 'needs_review',
      reason: 'No completed transaction amount identified',
      cleanText: fullText,
    };
  }

  // If there are multiple conflicting transactional amounts
  if (uniqueAmounts.length > 1 && uniqueAmounts.some((a) => Math.abs(a - candidateAmount!) > 0.001)) {
    return {
      outcome: 'ambiguous_review',
      confidence: 'needs_review',
      reason: 'Multiple distinct monetary amounts found in notification',
      amount: candidateAmount,
      direction,
      isRefund,
      isReversal,
      isTransfer,
      upiRef,
      accountLast4,
      candidateAmounts: uniqueAmounts,
      cleanText: fullText,
    };
  }

  // Amount sanity limit (Rs. 5,00,000)
  if (candidateAmount > 500000) {
    return {
      outcome: 'ambiguous_review',
      confidence: 'needs_review',
      reason: 'Amount exceeds plausible single-payment limit (possible balance/limit figure)',
      amount: candidateAmount,
      cleanText: fullText,
    };
  }

  // ── Step 9: Payee Extraction & Classification ──
  const payee = isTransfer ? 'Self / Internal Transfer' : extractCleanPayee(cleanTitle, cleanText, normPackage);

  if (isTransfer) {
    return {
      outcome: 'internal_transfer',
      confidence: 'high',
      reason: 'Internal transfer between own accounts',
      amount: candidateAmount,
      direction: 'transfer',
      isTransfer: true,
      payee,
      upiRef,
      accountLast4,
      cleanText: fullText,
    };
  }

  if (isReversal) {
    return {
      outcome: 'refund_reversal',
      confidence: 'high',
      reason: 'Completed payment reversal',
      amount: candidateAmount,
      direction: 'income',
      isRefund: true,
      isReversal: true,
      payee,
      upiRef,
      accountLast4,
      cleanText: fullText,
    };
  }

  if (isRefund) {
    return {
      outcome: 'refund_reversal',
      confidence: 'high',
      reason: 'Completed refund',
      amount: candidateAmount,
      direction: 'income',
      isRefund: true,
      isReversal: false,
      payee,
      upiRef,
      accountLast4,
      cleanText: fullText,
    };
  }

  if (direction === 'income') {
    return {
      outcome: 'completed_credit',
      confidence: 'high',
      reason: 'Completed credit / incoming payment',
      amount: candidateAmount,
      direction: 'income',
      payee,
      upiRef,
      accountLast4,
      cleanText: fullText,
    };
  }

  return {
    outcome: 'completed_debit',
    confidence: 'high',
    reason: 'Completed debit / outgoing expense',
    amount: candidateAmount,
    direction: 'expense',
    payee,
    upiRef,
    accountLast4,
    cleanText: fullText,
  };
}

/**
 * Normalizes text for merchant comparisons.
 */
function normalizeText(val: string | undefined): string {
  if (!val) return '';
  return val.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Checks if a payee string is a generic placeholder rather than a specific merchant name.
 */
function isGenericMerchant(m: string): boolean {
  const norm = normalizeText(m);
  if (!norm) return true;
  if (/^(?:payment|other|debit|credit)$/i.test(norm)) return true;
  if (/\b(?:bank|a\/c|account|upi|vpa|sms|alert|banking)\b/i.test(norm)) return true;
  if (/^vpa\b/i.test(norm) || /@(?:slc|upi|paytm|ybl|ibl|axl|oksbi|okhdfcbank|okicici|okaxis|apl|rapl|cred|jupiteraxis|federal)/i.test(norm)) {
    return true;
  }
  const bankNames = ['hdfc', 'sbi', 'icici', 'axis', 'kotak', 'pnb', 'bob', 'canara', 'indusind', 'yes bank', 'federal'];
  if (bankNames.some((b) => norm === b || norm.startsWith(`${b} `) || norm.endsWith(` ${b}`))) {
    return true;
  }
  const appNames = ['paytm', 'phonepe', 'google pay', 'gpay', 'slice', 'bhim', 'cred', 'jupiter', 'fi', 'navi'];
  if (appNames.some((a) => norm === a)) {
    return true;
  }
  return false;
}

/**
 * Checks if two merchant descriptions match or if they represent conflicting counterparties.
 */
export function checkMerchantMatch(
  payeeA: string,
  payeeB: string,
  textA: string,
  textB: string
): { isMatch: boolean; isConflicting: boolean } {
  const normA = normalizeText(payeeA);
  const normB = normalizeText(payeeB);

  const hasSpecificA = !isGenericMerchant(normA);
  const hasSpecificB = !isGenericMerchant(normB);

  // If both have specific non-generic merchants:
  if (hasSpecificA && hasSpecificB) {
    if (normA === normB || normA.includes(normB) || normB.includes(normA)) {
      return { isMatch: true, isConflicting: false };
    }
    // Check for truncated names e.g. "MANISH KUM" and "MANISH KUMAR DHANKA"
    const wordsA = normA.split(' ');
    const wordsB = normB.split(' ');
    if (
      wordsA.length >= 2 &&
      wordsB.length >= 2 &&
      wordsA[0] === wordsB[0] &&
      (wordsA[1].startsWith(wordsB[1]) || wordsB[1].startsWith(wordsA[1]))
    ) {
      return { isMatch: true, isConflicting: false };
    }
    // They are distinctly different merchants! (e.g. Starbucks vs Uber)
    return { isMatch: false, isConflicting: true };
  }

  // Cross-reference: does the full text of A contain payee B, or vice-versa?
  if (hasSpecificA && textB.toLowerCase().includes(normA)) {
    return { isMatch: true, isConflicting: false };
  }
  if (hasSpecificB && textA.toLowerCase().includes(normB)) {
    return { isMatch: true, isConflicting: false };
  }

  return { isMatch: false, isConflicting: false };
}

/**
 * Extracts a clean merchant, sender, or counterparty name from transaction text.
 */
export function extractCleanPayee(title: string, text: string, packageName: string): string {
  const combined = `${title} ${text}`.replace(/\s+/g, ' ').trim();

  // Pattern: "paid ... to [Payee]" or "sent ... to [Payee]"
  const toMatch = combined.match(
    /(?:paid(?:\s+(?:rs\.?|₹|inr)?\s*[\d,.]*)?\s+to|sent(?:\s+(?:rs\.?|₹|inr)?\s*[\d,.]*)?\s+to|transferred(?:\s+(?:rs\.?|₹|inr)?\s*[\d,.]*)?\s+to|\bto)\s+([A-Za-z0-9\s&.\-]{2,40}?)(?:\s+(?:on|using|via|for|ref|rrn|upi|balance|avl|a\/c)|\.|\s*$)/i
  );
  if (toMatch && toMatch[1]) {
    const candidate = toMatch[1].trim();
    if (!/^(?:upi|bank|account|your|a\/c|vpa)$/i.test(candidate)) return candidate;
  }

  // Pattern: "received ... from [Sender]"
  const fromMatch = combined.match(
    /(?:received(?:\s+(?:rs\.?|₹|inr)?\s*[\d,.]*)?\s+from|\bfrom)\s+([A-Za-z0-9\s&.\-]{2,40}?)(?:\s+(?:deposited|into|in|on|using|via|ref|rrn|upi|balance|avl|a\/c)|\.|\s*$)/i
  );
  if (fromMatch && fromMatch[1]) {
    const candidate = fromMatch[1].trim();
    if (!/^(?:upi|bank|account|your|a\/c|vpa)$/i.test(candidate)) return candidate;
  }

  // Pattern: "spent ... at [Merchant]"
  const atMatch = combined.match(
    /(?:spent(?:\s+(?:rs\.?|₹|inr)?\s*[\d,.]*)?\s+at|\bat)\s+([A-Za-z0-9\s&.\-]{2,40}?)(?:\s+(?:on|using|via|ref|rrn|upi|balance|avl|a\/c)|\.|\s*$)/i
  );
  if (atMatch && atMatch[1]) {
    return atMatch[1].trim();
  }

  // Pattern: "refund of ... for [Merchant]"
  const refundMerchantMatch = combined.match(
    /(?:refund(?:\s+of)?(?:\s+(?:rs\.?|₹|inr)?\s*[\d,.]*)?\s+for|from)\s+([A-Za-z0-9\s&.\-]{2,40}?)(?:\s+(?:order|processed|initiated|credited|\.|$))/i
  );
  if (refundMerchantMatch && refundMerchantMatch[1]) {
    return refundMerchantMatch[1].trim();
  }

  // App-specific fallbacks
  if (packageName.includes('slice')) return 'Slice';
  if (packageName.includes('paytm')) return 'Paytm';
  if (packageName.includes('phonepe')) return 'PhonePe';
  if (packageName.includes('paisa') || packageName.includes('nbu')) return 'Google Pay';
  if (packageName.includes('amazon')) return 'Amazon';

  if (title && !/^(?:bank|alert|hdfc|sbi|icici|axis|kotak|sms|transaction|notification)/i.test(title)) {
    return title.trim().slice(0, 30);
  }

  return 'Payment';
}

/**
 * Returns a human-friendly name for the notification source app.
 */
export function getFriendlySourceName(packageName: string, title: string): string {
  const normPkg = (packageName || '').toLowerCase();
  const normTitle = (title || '').toLowerCase();

  if (normPkg.includes('indwin.c3.shareapp') || normPkg.includes('mslice')) return 'Slice';
  if (normPkg.includes('phonepe')) return 'PhonePe';
  if (normPkg.includes('paytm')) return 'Paytm';
  if (normPkg.includes('paisa') || normPkg.includes('nbu')) return 'Google Pay';
  if (normPkg.includes('dreamplug')) return 'CRED';
  if (normPkg.includes('amazon')) return 'Amazon Pay';
  if (normPkg.includes('bhim')) return 'BHIM';
  if (normPkg.includes('jupiter')) return 'Jupiter';
  if (normPkg.includes('fi')) return 'Fi Money';
  if (normPkg.includes('naviapp')) return 'Navi';

  // Bank SMS
  if (SMS_PACKAGES.has(normPkg)) {
    if (normTitle.includes('hdfc')) return 'HDFC Bank (SMS)';
    if (normTitle.includes('sbi')) return 'SBI (SMS)';
    if (normTitle.includes('icici')) return 'ICICI Bank (SMS)';
    if (normTitle.includes('axis')) return 'Axis Bank (SMS)';
    if (normTitle.includes('kotak')) return 'Kotak Bank (SMS)';
    return 'Bank SMS';
  }

  if (normTitle.includes('hdfc')) return 'HDFC Bank';
  if (normTitle.includes('sbi')) return 'SBI';
  if (normTitle.includes('icici')) return 'ICICI Bank';
  if (normTitle.includes('axis')) return 'Axis Bank';

  return title && title.length < 20 ? title : 'Banking App';
}

/**
 * Correlates and deduplicates notifications using a strict 3-tier hierarchy:
 *
 * 1. Shared stable reference (UPI Ref / RRN / UTR): Merge into single transaction with both sources.
 * 2. Conservative match: Same direction, exact amount, time <= 5 min, compatible app, AND matching merchant.
 * 3. Insufficient evidence: Never silently merge or discard! Keep BOTH alerts visible for review, labeled "Possible duplicate".
 */
export function correlateAndDeduplicate(rawItems: RawNotificationItem[]): DeduplicatedTransaction[] {
  const classifiedItems: Array<{
    raw: RawNotificationItem;
    classified: ClassificationResult;
    sourceApp: string;
  }> = [];

  for (const raw of rawItems) {
    const res = classifyNotification(raw.packageName, raw.title, raw.text);
    if (res.confidence !== 'rejected') {
      classifiedItems.push({
        raw,
        classified: res,
        sourceApp: getFriendlySourceName(raw.packageName, raw.title),
      });
    }
  }

  // Sort chronologically
  classifiedItems.sort((a, b) => (a.raw.timestamp || 0) - (b.raw.timestamp || 0));

  const result: DeduplicatedTransaction[] = [];

  for (const item of classifiedItems) {
    const itemAmount = item.classified.amount || item.raw.amount || 0;
    const itemDirection = item.classified.direction || (item.raw.type === 'income' ? 'income' : 'expense');
    const itemTs = item.raw.timestamp || Date.now();
    const itemUpi = item.classified.upiRef || item.raw.upiRef;
    const itemAcct = item.classified.accountLast4 || item.raw.accountLast4;
    const itemText = `${item.raw.title} ${item.raw.text}`.toLowerCase();
    const itemPayee = item.classified.payee || extractCleanPayee(item.raw.title, item.raw.text, item.raw.packageName);

    let merged = false;
    let isPossibleDuplicate = false;
    let duplicateOfApp: string | undefined;

    for (const existing of result) {
      if (existing.direction !== itemDirection) continue;
      if (Math.abs(existing.amount - itemAmount) > 0.001) continue;

      const timeDiff = Math.abs(itemTs - existing.timestamp);
      const existingText = `${existing.title} ${existing.text}`.toLowerCase();

      // ── Level 1: Shared stable identifier (UPI Ref / RRN / UTR) ──
      const hasSharedRef = Boolean(
        (itemUpi && existing.upiRef && itemUpi === existing.upiRef) ||
        (itemUpi && existingText.includes(itemUpi)) ||
        (existing.upiRef && itemText.includes(existing.upiRef))
      );

      if (hasSharedRef) {
        // 100% Confident match via shared transaction identifier
        if (!existing.combinedSources.includes(item.sourceApp)) {
          existing.combinedSources.push(item.sourceApp);
          existing.sourceAppName = existing.combinedSources.join(' + ');
        }
        if (!existing.sourceAlerts) {
          existing.sourceAlerts = [{
            sourceApp: existing.combinedSources[0] || existing.sourceAppName,
            packageName: existing.packageName,
            title: existing.title,
            text: existing.text,
            timestamp: existing.timestamp,
            upiRef: existing.upiRef,
            accountLast4: existing.accountLast4,
          }];
        }
        existing.sourceAlerts.push({
          sourceApp: item.sourceApp,
          packageName: item.raw.packageName,
          title: item.raw.title,
          text: item.raw.text,
          timestamp: itemTs,
          upiRef: itemUpi,
          accountLast4: itemAcct,
        });
        if (!isGenericMerchant(itemPayee) && isGenericMerchant(existing.payee)) {
          existing.payee = itemPayee;
        }
        if (!existing.upiRef && itemUpi) existing.upiRef = itemUpi;
        if (!existing.accountLast4 && itemAcct) existing.accountLast4 = itemAcct;
        merged = true;
        break;
      }

      // If both have explicit reference numbers and they differ, they are provably separate payments!
      if (itemUpi && existing.upiRef && itemUpi !== existing.upiRef) {
        continue;
      }

      // If both alerts come from the same package/app with different notification IDs and no shared reference,
      // they are separate payments made within the same app
      if (item.raw.packageName === existing.packageName && item.raw.id !== existing.id) {
        continue;
      }

      // ── Level 2: Conservative match without shared reference ──
      // Requires:
      // 1. Close timestamps (within 5 minutes)
      // 2. Different apps (e.g. UPI app + Bank SMS)
      // 3. Positive evidence of matching merchant
      if (timeDiff <= 5 * 60 * 1000) {
        const merchantMatch = checkMerchantMatch(itemPayee, existing.payee, itemText, existingText);

        // If merchants are explicitly different (e.g. Starbucks vs Uber)
        if (merchantMatch.isConflicting) {
          // Do NOT merge! Keep as distinct separate payments!
          continue;
        }

        // Strong evidence requires verified matching non-generic merchant names on both sides!
        // Note: Matching accountLast4 or shared bank/app tokens CANNOT independently establish that two alerts are the same transaction!
        const hasStrongMerchantMatch =
          merchantMatch.isMatch &&
          !isGenericMerchant(itemPayee) &&
          !isGenericMerchant(existing.payee);

        if (hasStrongMerchantMatch) {
          // Confirmed duplicate with verified matching merchant across apps
          if (!existing.combinedSources.includes(item.sourceApp)) {
            existing.combinedSources.push(item.sourceApp);
            existing.sourceAppName = existing.combinedSources.join(' + ');
          }
          if (!existing.sourceAlerts) {
            existing.sourceAlerts = [{
              sourceApp: existing.combinedSources[0] || existing.sourceAppName,
              packageName: existing.packageName,
              title: existing.title,
              text: existing.text,
              timestamp: existing.timestamp,
              upiRef: existing.upiRef,
              accountLast4: existing.accountLast4,
            }];
          }
          existing.sourceAlerts.push({
            sourceApp: item.sourceApp,
            packageName: item.raw.packageName,
            title: item.raw.title,
            text: item.raw.text,
            timestamp: itemTs,
            upiRef: itemUpi,
            accountLast4: itemAcct,
          });
          if (!existing.upiRef && itemUpi) existing.upiRef = itemUpi;
          if (!existing.accountLast4 && itemAcct) existing.accountLast4 = itemAcct;
          merged = true;
          break;
        }

        // ── Level 3: Insufficient evidence (same amount & time, but no merchant & no shared ref) ──
        // Never silently merge or discard! Keep BOTH alerts visible for review, labeled "Possible duplicate"!
        isPossibleDuplicate = true;
        duplicateOfApp = existing.sourceAppName;

        // Also update existing so user sees both are flagged
        existing.isPossibleDuplicate = true;
        existing.possibleDuplicateOf = item.sourceApp;
        if (existing.confidence !== 'needs_review') {
          existing.confidence = 'needs_review';
          existing.confidenceReason = `Possible duplicate of ${item.sourceApp} alert (same amount within 5m, no shared reference)`;
        }
        // merged remains false so BOTH items are preserved in result for user review!
      }
    }

    if (!merged) {
      result.push({
        id: item.raw.id,
        packageName: item.raw.packageName,
        sourceAppName: item.sourceApp,
        combinedSources: [item.sourceApp],
        sourceAlerts: [{
          sourceApp: item.sourceApp,
          packageName: item.raw.packageName,
          title: item.raw.title,
          text: item.raw.text,
          timestamp: itemTs,
          upiRef: itemUpi,
          accountLast4: itemAcct,
        }],
        title: item.raw.title,
        text: item.raw.text,
        amount: itemAmount,
        direction: itemDirection,
        isRefund: Boolean(item.classified.isRefund),
        isReversal: Boolean(item.classified.isReversal),
        isTransfer: Boolean(item.classified.isTransfer),
        linkedExpenseId: item.classified.linkedExpenseId,
        timestamp: itemTs,
        payee: itemPayee,
        upiRef: itemUpi,
        accountLast4: itemAcct,
        confidence: (isPossibleDuplicate || item.classified.confidence === 'needs_review') ? 'needs_review' : 'high',
        confidenceReason: isPossibleDuplicate
          ? `Possible duplicate of ${duplicateOfApp || 'another'} alert (same amount within 5m, no shared reference)`
          : item.classified.reason,
        outcome: item.classified.outcome,
        isPossibleDuplicate,
        possibleDuplicateOf: duplicateOfApp,
      });
    }
  }

  return result;
}

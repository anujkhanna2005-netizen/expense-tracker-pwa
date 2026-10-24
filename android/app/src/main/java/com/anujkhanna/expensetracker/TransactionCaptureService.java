package com.anujkhanna.expensetracker;

import android.app.Notification;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.os.Bundle;
import org.json.JSONArray;
import org.json.JSONObject;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Locally queues outgoing payment alerts from known Indian banking / UPI apps.
 * Android requires the user to enable this listener in Settings.
 *
 * Design notes:
 *  - Only processes notifications from an allowlist of banking/UPI packages.
 *  - Credits, refunds, reversals, balance messages, OTP messages, and
 *    promotional messages are excluded before storing anything.
 *  - Dedup uses a rolling JSON array of SHA-256 keys (capped at MAX_SEEN entries).
 *  - Sanity cap of Rs. 5,00,000 avoids importing bank balance figures.
 *  - No notification data is sent to any server; data stays in private app storage.
 */
public class TransactionCaptureService extends NotificationListenerService {

    private static final String PREFS   = "transaction_capture";
    private static final String QUEUE   = "pending";
    private static final String DEDUPE  = "seen_keys";
    private static final String RECENT  = "recent_transactions";

    /** Maximum queued transactions retained (oldest dropped when exceeded). */
    private static final int MAX_QUEUE = 500;

    /** Maximum dedup keys retained. */
    private static final int MAX_SEEN = 2000;

    /** Maximum recent transaction fingerprints retained for cross-app deduplication. */
    private static final int MAX_RECENT = 200;

    /** Dedup time window (5 minutes) for matching bank SMS with UPI app notifications. */
    private static final long DEDUP_WINDOW_MS = 5 * 60 * 1000L;

    /**
     * Maximum plausible single-transaction amount in rupees.
     * Rejects balance figures that appear in many bank notifications.
     */
    private static final double MAX_AMOUNT = 500_000.0;

    /**
     * Known Indian banking and UPI application package names, plus SMS packages
     * for receiving bank debit SMS alerts.
     * NOTE: WhatsApp (com.whatsapp) is intentionally excluded because it is a personal
     * messaging app whose chat/photo notifications would produce false deductions.
     */
    private static final Set<String> ALLOWED_PACKAGES = new HashSet<>(Arrays.asList(
        // UPI / Wallet apps
        "com.phonepe.app",
        "com.phonepe.app.preprod",
        "net.one97.paytm",
        "com.google.android.apps.nbu.paisa.user",   // Google Pay
        "in.amazon.mShop.android.shopping",          // Amazon Pay
        "com.amazonpay",
        "com.mobikwik_new",
        "com.freecharge.android",
        "com.lcode.bhimupi",                         // BHIM
        "in.bhimupi",
        "in.org.npci.upiapp",
        "com.dreamplug.androidapp",                  // CRED
        "com.hdfcbank.payzapp",                      // PayZapp
        "com.enstage.wibmo.hdfc",
        "money.jupiter",                             // Jupiter
        "money.fi",                                  // Fi Money
        "indwin.c3.shareapp",                        // Slice
        "org.isometrik.mslice",
        "com.samsung.android.spay",                  // Samsung Wallet / Pay
        "com.tatadigital.tcp",                       // Tata Neu
        "com.myairtelapp",                           // Airtel Thanks
        "com.naviapp",                               // Navi
        "money.super",                               // Super.money
        "money.super.payments",
        "org.altruist.BajajExperia",                 // Bajaj Finserv
        "com.nextbillion.groww",                     // Groww
        "in.indwealth",                              // INDmoney
        // Major Indian bank apps
        "com.snapwork.hdfc",
        "com.hdfc.mobilebanking",
        "com.hdfcbank.android.now",
        "com.csam.icici.bank.imobile",
        "com.sbi.SBIFreedomPlus",
        "com.sbi.lotusintouch",
        "com.axis.mobile",
        "com.kotak.mahindra.kotak",
        "com.idfc.mobile.banking",
        "com.indusind.mobile",
        "com.rblbank.mobank",
        "com.fbl.superapp",                         // Federal Bank
        "com.canara.cbankapp",
        "com.bankofbaroda.mpassbook",
        "com.unionbankofindia.mobile",
        "com.pnb.mobile",
        "com.yesbank",
        // Email apps delivering bank/Slice debit/credit alerts
        "com.google.android.gm",
        // SMS apps delivering bank debit/credit alerts
        "com.google.android.apps.messaging",
        "com.samsung.android.messaging",
        "com.android.mms",
        "com.truecaller",
        "com.coloros.mms",
        "com.oneplus.mms",
        "com.vivo.mms"
    ));

    private static final Set<String> EMAIL_PACKAGES = new HashSet<>(Arrays.asList(
        "com.google.android.gm"
    ));

    private static final Set<String> SMS_PACKAGES = new HashSet<>(Arrays.asList(
        "com.google.android.apps.messaging",
        "com.samsung.android.messaging",
        "com.android.mms",
        "com.truecaller",
        "com.coloros.mms",
        "com.oneplus.mms",
        "com.vivo.mms"
    ));

    // Hard exclusion: Chat counts and security/login alerts
    private static final java.util.regex.Pattern CHAT_OR_SECURITY_PATTERN = java.util.regex.Pattern.compile(
        "(?i)(?:[0-9]+\\s*(?:photos?|images?|videos?|files?|audios?|messages?|contacts?|documents?|attachments?)|" +
        "\\b(?:otp|one.time.password|verification\\s*code|mpin|passcode|login alert)\\b)"
    );

    // Hard exclusion: Requests and failed/cancelled payments
    private static final java.util.regex.Pattern REQUEST_OR_FAILED_PATTERN = java.util.regex.Pattern.compile(
        "(?i)(?:\\b(?:has requested|requested money|payment request|request from|split bill)\\b|" +
        "\\b(?:failed|declined|unsuccessful|timed out|could not process|cancelled|canceled|payment pending|txn pending|pending payment)\\b)"
    );

    // Pure promotional, loan, and bill reminder patterns (checked when no completed debit/credit is present)
    private static final java.util.regex.Pattern PURE_PROMO_PATTERN = java.util.regex.Pattern.compile(
        "(?i)(?:\\bpre-?approved\\b|\\binstant loan\\b|\\bpersonal loan\\b|\\bcredit score\\b|\\bcibil\\b|" +
        "\\b(?:bill is due|bill due|due date|due on|upcoming bill|bill generated|reminder:|payment reminder)\\b|" +
        "\\bpay\\s+[0-9]+\\s*(?:times|upi\\s+payments?)\\b|" +
        "\\bpay\\s+(?:via|using|with)\\s+upi\\s+and\\s+(?:get|win|earn)\\b|" +
        "\\buse\\s+(?:amazon\\s*pay|paytm|phonepe|gpay|google\\s*pay)\\s+upi\\b|" +
        "\\bfor\\s+amazon\\s*shopping\\b|" +
        "\\bpay\\s+with\\s+amazon\\s*pay\\b|" +
        "\\bstand a chance\\b|\\blucky winner\\b|\\bchance to win\\b|\\bspin & win\\b|\\bspin the wheel\\b|" +
        "\\brefer(?:ral)?\\b|\\binvite friends?\\b)"
    );

    // Credit / Income Patterns (Currency is mandatory!)
    private static final java.util.regex.Pattern CREDIT_ACTION_THEN_AMT = java.util.regex.Pattern.compile(
        "(?i)(?:credited(?:\\s+(?:with|by|of))?|received|got|deposited|refund(?:ed)?|reversal|payment received(?:\\s+of)?|money received(?:\\s*[:\\-])?|added(?:\\s+to\\s+(?:your\\s+)?(?:account|wallet))?)\\s*[:\\-]?\\s*(?:rs\\.?|₹|inr)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)"
    );

    private static final java.util.regex.Pattern CREDIT_AMT_THEN_ACTION = java.util.regex.Pattern.compile(
        "(?i)(?:rs\\.?|₹|inr)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)\\s*(?:is|has been)?\\s*(?:successfully\\s+)?(?:credited|deposited|received|refunded|reversed)"
    );

    private static final java.util.regex.Pattern CREDIT_ALERT = java.util.regex.Pattern.compile(
        "(?i)credit alert!\\s*(?:rs\\.?|₹|inr)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)"
    );

    // Debit / Expense Patterns (Currency is mandatory!)
    private static final java.util.regex.Pattern DEBIT_ACTION_THEN_AMT = java.util.regex.Pattern.compile(
        "(?i)(?:debited(?:\\s+(?:with|by|for|of))?|paid(?:\\s+to)?|spent|sent|transferred|withdrawn|charged|deducted|payment\\s+of|txn\\s+of)\\s*[:\\-]?\\s*(?:rs\\.?|₹|inr)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)"
    );

    private static final java.util.regex.Pattern DEBIT_AMT_THEN_ACTION = java.util.regex.Pattern.compile(
        "(?i)(?:rs\\.?|₹|inr)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)\\s*(?:is|has been)?\\s*(?:successfully\\s+)?(?:debited|paid|spent|sent|transferred|withdrawn|charged|deducted)"
    );

    private static final java.util.regex.Pattern DEBIT_ALERT = java.util.regex.Pattern.compile(
        "(?i)(?:debit alert!|money sent\\s*[:\\-])\\s*(?:rs\\.?|₹|inr)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)"
    );

    // Metadata patterns for deduplication
    private static final java.util.regex.Pattern UPI_REF_PATTERN = java.util.regex.Pattern.compile(
        "(?i)(?:upi(?:\\s*ref(?:\\s*(?:no|id))?|/)?|rrn|txn\\s*id|ref(?:\\s*no)?)\\s*[:#\\s/]?\\s*([0-9]{9,16})"
    );

    private static final java.util.regex.Pattern ACCT_LAST4_PATTERN = java.util.regex.Pattern.compile(
        "(?i)(?:a\\/c|acct|account)\\s*(?:no\\.?|ending\\s*(?:in|with)?|[^0-9\\n]{0,10}[xX*]+)?\\s*([0-9]{3,4})"
    );

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        if (getPackageName().equals(sbn.getPackageName())) return;
        // Only process notifications from known banking/UPI/SMS/Email apps
        if (!ALLOWED_PACKAGES.contains(sbn.getPackageName())) return;

        Notification notification = sbn.getNotification();
        if (notification == null || notification.extras == null) return;

        Bundle extras = notification.extras;
        CharSequence titleValue = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textValue  = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        if (textValue == null) textValue = extras.getCharSequence(Notification.EXTRA_TEXT);
        if (textValue == null) return;

        String title    = titleValue == null ? "" : titleValue.toString();
        String body     = textValue.toString();
        String combined = title + " " + body;
        String lower    = combined.toLowerCase();

        // If received from an SMS app, strictly verify it is a bank / UPI alert
        if (SMS_PACKAGES.contains(sbn.getPackageName())) {
            boolean isBankSms = title.matches("(?i).*(?:bank|hdfc|sbi|icici|axis|kotak|pnb|bob|idfc|canara|indus|rbl|yesb|fed|paytm|upi|slice|cred|citi|scb|hsbc|baroda|unionb|central|mahabank).*")
                || lower.matches("(?s).*(?:\\ba\\/c\\b|\\bacct\\b|account|vpa|card ending|credit card|debit card|upi ref|rrn|transaction id|txn id|slice|imps|neft|rtgs).*");
            if (!isBankSms) return;
        }

        // If received from Gmail, strictly verify it is a bank / Slice transaction email
        if (EMAIL_PACKAGES.contains(sbn.getPackageName())) {
            boolean isBankEmail = title.matches("(?i).*(?:slice|bank|hdfc|sbi|icici|axis|kotak|pnb|bob|idfc|canara|indus|rbl|yesb|fed|paytm|cred|upi|amazon\\s*pay).*")
                || lower.matches("(?s).*(?:debited from|credited to|spent on|account xx|a\\/c xx|received .* in your).*");
            if (!isBankEmail) return;
        }

        // Ignore very short messages
        if (body.trim().length() < 8) return;

        // ── Step 1: Reject chat media, security alerts, payment requests, and failed payments ──
        if (CHAT_OR_SECURITY_PATTERN.matcher(combined).find()) {
            return;
        }
        if (REQUEST_OR_FAILED_PATTERN.matcher(combined).find()) {
            return;
        }

        // ── Step 2: Remove trailing remaining balance phrases ──
        String textWithoutBal = combined.replaceAll(
            "(?i)(?:avl\\.?\\s*bal(?:ance)?|avail(?:able)?\\s*bal(?:ance)?|a\\/c\\s*bal(?:ance)?|account\\s*balance|bal(?:ance)?\\s*:|avail(?:able)?\\s*limit).*$",
            ""
        );

        // ── Step 3: Determine transaction type & amount (Mandatory Currency) ──
        double amount = -1;
        String txnType = null;

        // Check Credit (Income) first
        java.util.regex.Matcher mCredit1 = CREDIT_ACTION_THEN_AMT.matcher(textWithoutBal);
        if (mCredit1.find()) {
            try { amount = Double.parseDouble(mCredit1.group(1).replace(",", "")); txnType = "income"; }
            catch (NumberFormatException ignored) {}
        }

        if (amount < 0) {
            java.util.regex.Matcher mCredit2 = CREDIT_AMT_THEN_ACTION.matcher(textWithoutBal);
            if (mCredit2.find()) {
                try { amount = Double.parseDouble(mCredit2.group(1).replace(",", "")); txnType = "income"; }
                catch (NumberFormatException ignored) {}
            }
        }

        if (amount < 0) {
            java.util.regex.Matcher mCredit3 = CREDIT_ALERT.matcher(textWithoutBal);
            if (mCredit3.find()) {
                try { amount = Double.parseDouble(mCredit3.group(1).replace(",", "")); txnType = "income"; }
                catch (NumberFormatException ignored) {}
            }
        }

        // Check Debit (Expense)
        if (amount < 0) {
            java.util.regex.Matcher mDebit1 = DEBIT_ACTION_THEN_AMT.matcher(textWithoutBal);
            if (mDebit1.find()) {
                try { amount = Double.parseDouble(mDebit1.group(1).replace(",", "")); txnType = "expense"; }
                catch (NumberFormatException ignored) {}
            }
        }

        if (amount < 0) {
            java.util.regex.Matcher mDebit2 = DEBIT_AMT_THEN_ACTION.matcher(textWithoutBal);
            if (mDebit2.find()) {
                try { amount = Double.parseDouble(mDebit2.group(1).replace(",", "")); txnType = "expense"; }
                catch (NumberFormatException ignored) {}
            }
        }

        if (amount < 0) {
            java.util.regex.Matcher mDebit3 = DEBIT_ALERT.matcher(textWithoutBal);
            if (mDebit3.find()) {
                try { amount = Double.parseDouble(mDebit3.group(1).replace(",", "")); txnType = "expense"; }
                catch (NumberFormatException ignored) {}
            }
        }

        // Strict: If neither credit nor debit with valid currency amount was matched, reject!
        if (amount <= 0 || amount > MAX_AMOUNT || txnType == null) {
            return;
        }

        // ── Step 4: Extract deduplication metadata ──
        String upiRef = null;
        java.util.regex.Matcher mUpi = UPI_REF_PATTERN.matcher(combined);
        if (mUpi.find()) {
            upiRef = mUpi.group(1);
        }

        String acctLast4 = null;
        java.util.regex.Matcher mAcct = ACCT_LAST4_PATTERN.matcher(combined);
        if (mAcct.find()) {
            acctLast4 = mAcct.group(1);
        }

        long now = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();
        String notifKey = sha256(sbn.getPackageName() + "|" + now + "|" + title + "|" + body);

        // ── Step 5: Intelligent cross-channel deduplication ──
        android.content.SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        try {
            JSONArray seenArray = new JSONArray(prefs.getString(DEDUPE, "[]"));
            for (int i = 0; i < seenArray.length(); i++) {
                if (notifKey.equals(seenArray.optString(i))) return; // Exact notification already processed
            }

            JSONArray recentList = new JSONArray(prefs.getString(RECENT, "[]"));
            JSONArray trimmedRecent = new JSONArray();
            boolean isDuplicate = false;

            for (int i = 0; i < recentList.length(); i++) {
                JSONObject prev = recentList.optJSONObject(i);
                if (prev == null) continue;

                long prevTs = prev.optLong("timestamp", 0);
                // Prune records older than 30 minutes
                if (Math.abs(now - prevTs) > 30 * 60 * 1000L) continue;

                trimmedRecent.put(prev);

                if (isDuplicate) continue; // Keep pruning rest

                double prevAmt = prev.optDouble("amount", -1);
                String prevType = prev.optString("type", "");
                String prevUpi = prev.optString("upiRef", "");
                String prevAcct = prev.optString("accountLast4", "");
                String prevPkg = prev.optString("packageName", "");
                String prevText = prev.optString("text", "").toLowerCase();

                // Match: Confident duplicate via shared stable transaction identifier (UPI Ref / RRN / UTR)
                boolean hasSharedRef = false;
                if (upiRef != null && !upiRef.isEmpty()) {
                    if (upiRef.equals(prevUpi) || prevText.contains(upiRef)) {
                        hasSharedRef = true;
                    }
                }
                if (!hasSharedRef && prevUpi != null && !prevUpi.isEmpty()) {
                    if (lower.contains(prevUpi)) {
                        hasSharedRef = true;
                    }
                }

                if (hasSharedRef && Math.abs(amount - prevAmt) < 0.001 && txnType.equals(prevType)) {
                    isDuplicate = true;
                    continue;
                }
            }

            if (isDuplicate) {
                // If the original transaction is currently waiting in the pending queue, associate this second source
                try {
                    JSONArray currentQueue = new JSONArray(prefs.getString(QUEUE, "[]"));
                    boolean queueUpdated = false;
                    for (int q = 0; q < currentQueue.length(); q++) {
                        JSONObject qItem = currentQueue.optJSONObject(q);
                        if (qItem == null) continue;
                        String qUpi = qItem.optString("upiRef", "");
                        boolean refMatches = (upiRef != null && !upiRef.isEmpty() && (upiRef.equals(qUpi) || qItem.optString("text", "").contains(upiRef)));
                        if (refMatches && Math.abs(amount - qItem.optDouble("amount", -1)) < 0.001 && txnType.equals(qItem.optString("type"))) {
                            String existingSources = qItem.optString("combinedSources", qItem.optString("packageName"));
                            if (!existingSources.contains(sbn.getPackageName())) {
                                qItem.put("combinedSources", existingSources + "," + sbn.getPackageName());
                                queueUpdated = true;
                            }
                            if (upiRef != null && !qItem.has("upiRef")) {
                                qItem.put("upiRef", upiRef);
                                queueUpdated = true;
                            }
                            if (acctLast4 != null && !qItem.has("accountLast4")) {
                                qItem.put("accountLast4", acctLast4);
                                queueUpdated = true;
                            }
                            break;
                        }
                    }
                    if (queueUpdated) {
                        prefs.edit().putString(QUEUE, currentQueue.toString()).apply();
                    }
                } catch (Exception ignored) {}

                // Save key in seenArray so this duplicate isn't re-evaluated, but don't add to queue
                seenArray.put(notifKey);
                if (seenArray.length() > MAX_SEEN) {
                    JSONArray trimmedSeen = new JSONArray();
                    for (int i = seenArray.length() - MAX_SEEN; i < seenArray.length(); i++) trimmedSeen.put(seenArray.get(i));
                    seenArray = trimmedSeen;
                }
                prefs.edit()
                    .putString(DEDUPE, seenArray.toString())
                    .putString(RECENT, trimmedRecent.toString())
                    .apply();
                return;
            }

            // ── Step 6: Queue new validated transaction ──
            JSONArray queue  = new JSONArray(prefs.getString(QUEUE, "[]"));
            JSONObject record = new JSONObject();
            record.put("id",           notifKey);
            record.put("packageName",  sbn.getPackageName());
            record.put("title",        title);
            record.put("text",         body);
            record.put("amount",       amount);
            record.put("type",         txnType);
            record.put("timestamp",    now);
            if (upiRef != null) record.put("upiRef", upiRef);
            if (acctLast4 != null) record.put("accountLast4", acctLast4);

            queue.put(record);

            // Add to recent list for dedup of subsequent alerts
            JSONObject recentEntry = new JSONObject();
            recentEntry.put("id",           notifKey);
            recentEntry.put("packageName",  sbn.getPackageName());
            recentEntry.put("amount",       amount);
            recentEntry.put("type",         txnType);
            recentEntry.put("timestamp",    now);
            recentEntry.put("text",         combined);
            if (upiRef != null) recentEntry.put("upiRef", upiRef);
            if (acctLast4 != null) recentEntry.put("accountLast4", acctLast4);
            trimmedRecent.put(recentEntry);

            if (trimmedRecent.length() > MAX_RECENT) {
                JSONArray cappedRecent = new JSONArray();
                for (int i = trimmedRecent.length() - MAX_RECENT; i < trimmedRecent.length(); i++) cappedRecent.put(trimmedRecent.get(i));
                trimmedRecent = cappedRecent;
            }

            // Trim queue to MAX_QUEUE (keep newest entries)
            if (queue.length() > MAX_QUEUE) {
                JSONArray trimmed = new JSONArray();
                for (int i = queue.length() - MAX_QUEUE; i < queue.length(); i++) trimmed.put(queue.get(i));
                queue = trimmed;
            }

            // Append key and trim seen list to MAX_SEEN
            seenArray.put(notifKey);
            if (seenArray.length() > MAX_SEEN) {
                JSONArray trimmedSeen = new JSONArray();
                for (int i = seenArray.length() - MAX_SEEN; i < seenArray.length(); i++) trimmedSeen.put(seenArray.get(i));
                seenArray = trimmedSeen;
            }

            prefs.edit()
                .putString(QUEUE,  queue.toString())
                .putString(DEDUPE, seenArray.toString())
                .putString(RECENT, trimmedRecent.toString())
                .apply();

        } catch (Exception ignored) { }
    }

    private String sha256(String value) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder();
            for (byte b : bytes) out.append(String.format("%02x", b));
            return out.toString();
        } catch (Exception e) {
            return Long.toString(System.currentTimeMillis());
        }
    }
}

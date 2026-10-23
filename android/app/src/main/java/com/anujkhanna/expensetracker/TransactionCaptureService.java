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

    /** Maximum queued transactions retained (oldest dropped when exceeded). */
    private static final int MAX_QUEUE = 500;

    /** Maximum dedup keys retained. */
    private static final int MAX_SEEN = 2000;

    /**
     * Maximum plausible single-transaction amount in rupees.
     * Rejects balance figures that appear in many bank notifications.
     */
    private static final double MAX_AMOUNT = 500_000.0;

    /**
     * Known Indian banking and UPI application package names, plus SMS packages
     * for receiving bank debit SMS alerts.
     */
    private static final Set<String> ALLOWED_PACKAGES = new HashSet<>(Arrays.asList(
        // UPI / Wallet apps
        "com.phonepe.app",
        "com.phonepe.app.preprod",
        "net.one97.paytm",
        "com.google.android.apps.nbu.paisa.user",   // Google Pay
        "in.amazon.mShop.android.shopping",          // Amazon Pay
        "com.amazonpay",
        "com.whatsapp",                              // WhatsApp Pay
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
            boolean isBankSms = title.matches("(?i).*(?:bank|hdfc|sbi|icici|axis|kotak|pnb|bob|idfc|canara|indus|rbl|yesb|fed|paytm|upi|slice).*")
                || lower.matches("(?s).*(?:\\ba\\/c\\b|\\bacct\\b|account|vpa|card ending|credit card|debit card|upi ref|transaction id|txn id|slice).*");
            if (!isBankSms) return;
        }

        // If received from Gmail, strictly verify it is a bank / Slice transaction email
        if (EMAIL_PACKAGES.contains(sbn.getPackageName())) {
            boolean isBankEmail = title.matches("(?i).*(?:slice|bank|hdfc|sbi|icici|axis|kotak|pnb|bob|idfc|canara|indus|rbl|yesb|fed|paytm|cred|upi|amazon\\s*pay).*")
                || lower.matches("(?s).*(?:debited from|credited to|spent on|account xx|a\\/c xx|received .* in your).*");
            if (!isBankEmail) return;
        }

        // Ignore very short messages (likely OTPs, PINs or greetings)
        if (body.trim().length() < 15) return;

        // ── Determine transaction type: expense vs income ─────────────────────
        boolean isCredit = lower.matches("(?s).*(\\bcredited\\b|credit received|received|you've got|you have got|money received|payment received|added to your|deposited).*");
        boolean isDebit  = lower.matches("(?s).*(\\bdebited\\b|\\bdebit\\b|\\bpaid\\b|\\bsent\\b|\\bspent\\b|\\bwithdrawn\\b|\\bcharged\\b|payment successful|txn successful|transaction successful|money sent|transfer successful|transferred).*");

        if (!isCredit && !isDebit) {
            if (lower.contains("upi")) {
                isDebit = true;
            } else {
                return;
            }
        }

        // Received money from someone is income; otherwise debit is expense
        String txnType = (isCredit && !isDebit) || lower.matches("(?s).*(?:received|you've got|you have got|credited).*from.*") ? "income" : "expense";

        // ── Exclusion filter: failed, OTPs, login, promos ─────────────────────
        if (lower.matches("(?s).*(\\bfailed\\b|\\bdeclined\\b|\\bpending\\b|\\botp\\b|one.time.password|login|verification|special offer|congratulation).*")) {
            return;
        }

        // ── Remove trailing remaining balance phrases to avoid extracting balance instead of debit/credit ──
        String textWithoutBal = combined.replaceAll("(?i)(?:avl\\.?\\s*bal(?:ance)?|avail(?:able)?\\s*bal(?:ance)?|a\\/c\\s*bal(?:ance)?|account\\s*balance|bal(?:ance)?\\s*:|avail(?:able)?\\s*limit).*$", "");

        // ── Amount extraction ─────────────────────────────────────────────────
        double amount = -1;

        // 1. Explicit action followed by amount: "debited by Rs 500", "paid ₹250", "spent INR 1,200", "got ₹280", "received ₹500"
        java.util.regex.Pattern actionAfterPattern = java.util.regex.Pattern.compile(
            "(?i)(?:debited(?:\\s+(?:by|for|with|of))?|paid(?:\\s+to)?|spent|sent|transferred|withdrawn|charged|received|got|credited(?:\\s+with)?|payment\\s+of|amount\\s+of)\\s*[:\\-]?\\s*(?:rs\\.?|₹|inr)?\\s*([0-9,]+(?:\\.[0-9]{1,2})?)"
        );
        java.util.regex.Matcher m1 = actionAfterPattern.matcher(textWithoutBal);
        if (m1.find()) {
            try { amount = Double.parseDouble(m1.group(1).replace(",", "")); }
            catch (NumberFormatException ignored) {}
        }

        // 2. Amount followed by action: "Rs. 450 debited", "₹1,200 paid", "₹280 received"
        if (amount < 0) {
            java.util.regex.Pattern actionBeforePattern = java.util.regex.Pattern.compile(
                "(?i)(?:rs\\.?|₹|inr)\\s*[:\\-]?\\s*([0-9,]+(?:\\.[0-9]{1,2})?)\\s*(?:is|has been)?\\s*(?:debited|paid|spent|sent|transferred|withdrawn|charged|received|credited)"
            );
            java.util.regex.Matcher m2 = actionBeforePattern.matcher(textWithoutBal);
            if (m2.find()) {
                try { amount = Double.parseDouble(m2.group(1).replace(",", "")); }
                catch (NumberFormatException ignored) {}
            }
        }

        // 3. Fallback: Any currency amount in textWithoutBal
        if (amount < 0) {
            java.util.regex.Pattern genericPattern = java.util.regex.Pattern.compile(
                "(?i)(?:₹|rs\\.?\\s*|inr\\s*)([0-9,]+(?:\\.[0-9]{1,2})?)"
            );
            java.util.regex.Matcher m3 = genericPattern.matcher(textWithoutBal);
            if (m3.find()) {
                try { amount = Double.parseDouble(m3.group(1).replace(",", "")); }
                catch (NumberFormatException ignored) {}
            }
        }

        // 4. Ultimate fallback on full text with Pattern 1
        if (amount < 0) {
            java.util.regex.Matcher m4 = actionAfterPattern.matcher(combined);
            if (m4.find()) {
                try { amount = Double.parseDouble(m4.group(1).replace(",", "")); }
                catch (NumberFormatException ignored) {}
            }
        }

        if (amount <= 0 || amount > MAX_AMOUNT) return;

        // ── Dedup using a rolling JSON array ──────────────────────────────────
        String key = sha256(sbn.getPackageName() + "|" + sbn.getPostTime() + "|" + title + "|" + body);
        android.content.SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        try {
            JSONArray seenArray = new JSONArray(prefs.getString(DEDUPE, "[]"));
            for (int i = 0; i < seenArray.length(); i++) {
                if (key.equals(seenArray.optString(i))) return; // already processed
            }

            JSONArray queue  = new JSONArray(prefs.getString(QUEUE, "[]"));
            JSONObject record = new JSONObject();
            record.put("id",          key);
            record.put("packageName", sbn.getPackageName());
            record.put("title",       title);
            record.put("text",        body);
            record.put("amount",      amount);
            record.put("type",        txnType);
            record.put("timestamp",   sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis());
            queue.put(record);

            // Trim queue to MAX_QUEUE (keep newest entries)
            if (queue.length() > MAX_QUEUE) {
                JSONArray trimmed = new JSONArray();
                for (int i = queue.length() - MAX_QUEUE; i < queue.length(); i++) trimmed.put(queue.get(i));
                queue = trimmed;
            }

            // Append key and trim seen list to MAX_SEEN (keep newest entries)
            seenArray.put(key);
            if (seenArray.length() > MAX_SEEN) {
                JSONArray trimmedSeen = new JSONArray();
                for (int i = seenArray.length() - MAX_SEEN; i < seenArray.length(); i++) trimmedSeen.put(seenArray.get(i));
                seenArray = trimmedSeen;
            }

            prefs.edit()
                .putString(QUEUE,  queue.toString())
                .putString(DEDUPE, seenArray.toString())
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

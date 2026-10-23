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
     * Known Indian banking and UPI application package names.
     * Only notifications from these apps are considered.
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
        // Major Indian bank apps
        "com.snapwork.hdfc",
        "com.hdfc.mobilebanking",
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
        "com.pnb.mobile"
    ));

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        if (getPackageName().equals(sbn.getPackageName())) return;
        // Only process notifications from known banking/UPI apps
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

        // Ignore very short messages (likely OTPs or PINs)
        if (body.trim().length() < 20) return;

        // ── Must contain a debit-indicating keyword ───────────────────────────
        if (!lower.matches("(?s).*(\\bupi\\b|debited|\\bdebit\\b|\\bpaid\\b|\\bsent\\b|payment successful|txn successful|transaction successful|money sent|transfer successful|transferred).*")) {
            return;
        }

        // ── Exclusion filter: credits, reversals, OTPs, balance messages, promos ─
        if (lower.matches("(?s).*(\\bcredited\\b|credit received|received from|money received|\\brefund\\b|reversed|reversal|\\bfailed\\b|\\bdeclined\\b|\\bpending\\b|\\botp\\b|one.time.password|cashback|\\breward\\b|loyalty|special offer|congratulation|avl bal|available balance|a\\/c balance|account balance|balance is|balance:|\\bbal\\b).*")) {
            return;
        }

        // ── Amount extraction ─────────────────────────────────────────────────
        // Prefer amount immediately following a debit-indicating keyword/symbol
        java.util.regex.Pattern debitAmountPattern = java.util.regex.Pattern.compile(
            "(?i)(?:debited|paid|sent|transferred|payment of|amount of|rs\\.?|₹|inr)\\s*[:\\-]?\\s*([0-9,]+(?:\\.[0-9]{1,2})?)"
        );
        java.util.regex.Matcher debitMatcher = debitAmountPattern.matcher(combined);
        double amount = -1;
        if (debitMatcher.find()) {
            try { amount = Double.parseDouble(debitMatcher.group(1).replace(",", "")); }
            catch (NumberFormatException ignored) { }
        }

        // Fall back: any currency amount in the message
        if (amount < 0) {
            java.util.regex.Pattern genericPattern = java.util.regex.Pattern.compile(
                "(?i)(?:₹|rs\\.?\\s*|inr\\s*)([0-9,]+(?:\\.[0-9]{1,2})?)"
            );
            java.util.regex.Matcher genericMatcher = genericPattern.matcher(combined);
            if (genericMatcher.find()) {
                try { amount = Double.parseDouble(genericMatcher.group(1).replace(",", "")); }
                catch (NumberFormatException ignored) { }
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
            record.put("timestamp",   sbn.getPostTime());
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

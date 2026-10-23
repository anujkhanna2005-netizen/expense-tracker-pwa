package com.anujkhanna.expensetracker;

import android.app.Notification;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.os.Bundle;
import org.json.JSONArray;
import org.json.JSONObject;
import java.security.MessageDigest;

/** Locally queues outgoing payment alerts. Android requires the user to enable this listener. */
public class TransactionCaptureService extends NotificationListenerService {
    private static final String PREFS = "transaction_capture";
    private static final String QUEUE = "pending";
    private static final String DEDUPE = "seen";

    @Override public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || getPackageName().equals(sbn.getPackageName())) return;
        Notification notification = sbn.getNotification();
        if (notification == null || notification.extras == null) return;
        Bundle extras = notification.extras;
        CharSequence titleValue = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textValue = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        if (textValue == null) textValue = extras.getCharSequence(Notification.EXTRA_TEXT);
        if (textValue == null) return;
        String title = titleValue == null ? "" : titleValue.toString();
        String body = textValue.toString();
        String searchable = (title + " " + body).toLowerCase();
        if (!searchable.matches("(?s).*(upi|debited|debit|paid|sent|payment successful|txn successful|transaction successful).*")) return;
        if (searchable.matches("(?s).*(credited|credit received|received from|refund|reversed|failed|declined|pending).*")) return;
        java.util.regex.Matcher amount = java.util.regex.Pattern.compile("(?i)(?:₹|rs\\.?\\s*|inr\\s*)([0-9,]+(?:\\.[0-9]{1,2})?)").matcher(title + " " + body);
        if (!amount.find()) return;
        String amountString = amount.group(1).replace(",", "");
        String key = sha256(sbn.getPackageName() + "|" + sbn.getPostTime() + "|" + title + "|" + body);
        android.content.SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String seen = prefs.getString(DEDUPE, "|");
        if (seen.contains("|" + key + "|")) return;
        try {
            JSONArray queue = new JSONArray(prefs.getString(QUEUE, "[]"));
            JSONObject record = new JSONObject();
            record.put("id", key);
            record.put("packageName", sbn.getPackageName());
            record.put("title", title);
            record.put("text", body);
            record.put("amount", Double.parseDouble(amountString));
            record.put("timestamp", sbn.getPostTime());
            queue.put(record);
            if (queue.length() > 500) {
                JSONArray trimmed = new JSONArray();
                for (int i = queue.length() - 500; i < queue.length(); i++) trimmed.put(queue.get(i));
                queue = trimmed;
            }
            String nextSeen = (seen + key + "|");
            if (nextSeen.length() > 16000) nextSeen = "|" + key + "|";
            prefs.edit().putString(QUEUE, queue.toString()).putString(DEDUPE, nextSeen).apply();
        } catch (Exception ignored) { }
    }

    private String sha256(String value) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder();
            for (byte b : bytes) out.append(String.format("%02x", b));
            return out.toString();
        } catch (Exception e) { return Long.toString(System.currentTimeMillis()); }
    }
}

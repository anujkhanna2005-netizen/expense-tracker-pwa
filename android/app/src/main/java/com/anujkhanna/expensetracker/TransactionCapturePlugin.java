package com.anujkhanna.expensetracker;

import android.content.ComponentName;
import android.content.Intent;
import android.provider.Settings;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "TransactionCapture")
public class TransactionCapturePlugin extends Plugin {
    @PluginMethod public void getStatus(PluginCall call) {
        String listeners = android.provider.Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
        ComponentName component = new ComponentName(getContext(), TransactionCaptureService.class);
        boolean enabled = listeners != null && listeners.contains(component.flattenToString());
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        call.resolve(result);
    }

    @PluginMethod public void openAccessSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    /**
     * Reads locally queued transactions without prematurely destroying them.
     * The app confirms safe storage via ackTransactions(ids) before items are removed.
     */
    @PluginMethod public void drainTransactions(PluginCall call) {
        android.content.SharedPreferences prefs = getContext().getSharedPreferences("transaction_capture", android.content.Context.MODE_PRIVATE);
        try {
            String pendingStr = prefs.getString("pending", "[]");
            JSArray array = new JSArray(pendingStr);
            JSObject result = new JSObject();
            result.put("transactions", array);

            // Backward compatibility: if autoClear is explicitly requested, clear immediately
            if (Boolean.TRUE.equals(call.getBoolean("autoClear", false))) {
                prefs.edit().putString("pending", "[]").apply();
            }

            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not read locally queued transactions: " + e.getMessage(), e);
        }
    }

    /**
     * Acknowledges safe persistence of drained transaction IDs in the app's review queue.
     * Removes only the acknowledged IDs from native pending storage.
     */
    @PluginMethod public void ackTransactions(PluginCall call) {
        JSArray idsArray = call.getArray("ids");
        if (idsArray == null || idsArray.length() == 0) {
            call.resolve();
            return;
        }

        android.content.SharedPreferences prefs = getContext().getSharedPreferences("transaction_capture", android.content.Context.MODE_PRIVATE);
        try {
            Set<String> ackSet = new HashSet<>();
            for (int i = 0; i < idsArray.length(); i++) {
                ackSet.add(idsArray.getString(i));
            }

            String pendingStr = prefs.getString("pending", "[]");
            JSONArray current = new JSONArray(pendingStr);
            JSONArray remaining = new JSONArray();

            for (int i = 0; i < current.length(); i++) {
                JSONObject obj = current.optJSONObject(i);
                if (obj != null) {
                    String id = obj.optString("id", "");
                    if (!ackSet.contains(id)) {
                        remaining.put(obj);
                    }
                }
            }

            prefs.edit().putString("pending", remaining.toString()).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to acknowledge transactions: " + e.getMessage(), e);
        }
    }
}

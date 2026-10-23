package com.anujkhanna.expensetracker;

import android.content.ComponentName;
import android.content.Intent;
import android.provider.Settings;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;

@CapacitorPlugin(name = "TransactionCapture")
public class TransactionCapturePlugin extends Plugin {
    @PluginMethod public void getStatus(PluginCall call) {
        String listeners = android.provider.Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
        ComponentName component = new ComponentName(getContext(), TransactionCaptureService.class);
        boolean enabled = listeners != null && listeners.contains(component.flattenToString());
        JSObject result = new JSObject(); result.put("enabled", enabled); call.resolve(result);
    }

    @PluginMethod public void openAccessSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod public void drainTransactions(PluginCall call) {
        android.content.SharedPreferences prefs = getContext().getSharedPreferences("transaction_capture", android.content.Context.MODE_PRIVATE);
        try {
            JSONArray records = new JSONArray(prefs.getString("pending", "[]"));
            prefs.edit().putString("pending", "[]").apply();
            JSObject result = new JSObject(); result.put("transactions", JSArray.from(records)); call.resolve(result);
        } catch (Exception e) { call.reject("Could not read locally queued transactions", e); }
    }
}

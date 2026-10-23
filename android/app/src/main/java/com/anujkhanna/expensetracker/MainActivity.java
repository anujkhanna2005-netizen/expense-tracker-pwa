package com.anujkhanna.expensetracker;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(TransactionCapturePlugin.class);
        super.onCreate(savedInstanceState);
    }
}

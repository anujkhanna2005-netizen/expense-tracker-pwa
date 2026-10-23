# Expense Tracker

Personal expense tracker built with React, TypeScript, Vite, and Capacitor.

## Android notification capture

The Android build includes a local `NotificationListenerService`. After the user explicitly enables notification access in Android Settings, it recognizes a limited set of outgoing payment notifications, queues matching alerts in private app storage, and imports them into expenses when the app is opened or resumed. There is no confirmation for each payment. Credits, refunds, failed payments, and pending payments are excluded. Category rules run locally using notification text.

Android requires the user to grant notification access; the app cannot enable this permission itself. Android notification access may expose notification content from other apps to the listener, so this implementation only retains matching outgoing-payment alerts and disables Android app-data backup. Notifications that are hidden, grouped, or formatted unexpectedly may not be captured, and a UPI app plus bank notification for the same payment can still produce duplicates.

The Android app's local data is separate from the hosted PWA's browser storage. This implementation does not sync expenses between devices or to the hosted website.

## Build

```sh
npm ci
npm run build
npx cap sync android
npx cap open android
```

Build/install the Android app from Android Studio with the Android SDK installed. On the phone, open **Settings → Automatic payment capture → Enable on Android**, then enable **Expense Tracker transaction capture** in Android's Notification access settings. Captured payments are imported next time the tracker is open or resumed.

## Statement imports

The Expenses page can also import bank CSV files and password-protected HDFC statement PDFs. Files are parsed locally in the browser and shown for review before import.

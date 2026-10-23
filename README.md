# Expense Tracker

Personal expense tracker built with React, TypeScript, Vite, and Capacitor.

---

## Features

- **Bank statement import** — upload a CSV export from any Indian bank, or a password-protected HDFC statement PDF. Files are parsed in the browser; no data leaves your device. Credits, refunds, and failed payments are skipped automatically. Review and edit suggested categories before importing.
- **Automatic payment capture (Android APK only)** — a `NotificationListenerService` watches payment notifications from a list of known Indian banking and UPI apps and queues matched outgoing payments locally. Expenses are imported when the app is opened or resumed.
- **Category suggestions** — built-in keyword rules cover fuel, food & dining, groceries, electricity, water, internet, mobile recharge, LPG, medical, entertainment, travel, shopping, rent, EMI, insurance, education, and fitness.

---

## Web / PWA

The hosted PWA (Vercel) does **not** have access to Android system notifications. Statement import works in any browser.

```sh
npm install        # after first clone or after switching branches
npm run build      # production build
npm run dev        # local dev server
```

---

## Android APK — prerequisites

> **SDK licence:** The Android SDK licence is a legally binding agreement. You must read and accept it yourself via Android Studio or the command line (`sdkmanager --licenses`). Do not accept it on someone else's behalf.

1. Install [Android Studio](https://developer.android.com/studio) (includes the Android SDK).
2. Accept the SDK licence inside Android Studio (or run `sdkmanager --licenses` in a terminal).
3. Ensure `ANDROID_HOME` is set in your environment (Android Studio usually does this).

---

## Android APK — build & install

```sh
npm install
npm run build
npx cap sync android      # copies the web build into the Android project
npx cap open android      # opens the project in Android Studio
```

Inside Android Studio:

1. Wait for Gradle sync to finish.
2. Connect your phone via USB (or use an emulator) and choose **Run → Run 'app'**.
3. The first build downloads Gradle dependencies; allow a few minutes.

---

## Enabling notification capture

Once the APK is installed:

1. Open the app → **Settings → Automatic payment capture → Enable on Android**.
2. Android opens the **Notification access** settings screen. Find **Expense Tracker transaction capture** and switch it on.
3. Payment notifications from supported apps (PhonePe, Google Pay, BHIM, Paytm, HDFC, SBI, ICICI, Axis, Kotak, etc.) are now queued automatically.
4. Expenses are imported silently the next time the app is opened or brought to the foreground.

---

## Statement import

On the **Expenses** page, press **Import statement**:

- **CSV** — exported from HDFC, SBI, ICICI, Axis, or any bank. Column headers must include a date column and a debit/withdrawal column (standard bank export headers are detected automatically).
- **HDFC PDF** — password-protected statement PDF. Enter your statement password; it is used only to open the file and is not stored anywhere.

After parsing, a preview table shows each debit row with a suggested category. Use the header checkbox to select/deselect all rows. Rows already in your tracker are unselected by default. Edit categories before clicking **Import**.

---

## Troubleshooting

| Issue | What to check |
|-------|---------------|
| CSV parse fails | Ensure the file has a header row. Rename columns to `Date`, `Description`/`Narration`, and `Debit`/`Withdrawal` if auto-detection fails. |
| HDFC PDF – wrong password | Try the 8-digit date-of-birth format (DDMMYYYY) used by HDFC for default passwords. |
| Notification not captured | Confirm the app appears in Android Notification access settings and is toggled on. Some apps send grouped/silent notifications that listeners cannot read. |
| Same transaction imported twice | A UPI app and a bank app can both send a notification for the same payment. Use the deselect-all checkbox and manually select unique rows before importing. |
| Amount looks like a balance | The parser uses a Rs. 5,00,000 sanity cap. Transactions above this limit are skipped. If a legitimate large payment is missed, import it manually. |
| APK build fails | Make sure the Android SDK is installed and `ANDROID_HOME` is set. Run `npx cap doctor` to diagnose missing dependencies. |

---

## Limitations

- The notification listener is native Android code. It **will not run in the browser PWA** installed from Vercel.
- Android app data is stored locally on the device and **does not sync** with the hosted PWA or other devices.
- Notification formats vary by bank and app version. Validate the listener with real notifications from your own payment apps before relying on it.
- The listener has not been compiled or tested on a physical device yet. Build and test the APK before trusting it with real transaction data.

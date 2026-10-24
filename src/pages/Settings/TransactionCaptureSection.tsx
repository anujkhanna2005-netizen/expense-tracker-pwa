import React, { useCallback, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import Button from '../../components/ui/Button';
import { transactionCaptureService, cleanupCorruptedTransactions, undoCleanup } from '../../services/transactionCaptureService';
import { useCapturedStore } from '../../stores/capturedTransactionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import { ReviewCapturedModal } from '../../components/ReviewCapturedModal';
import styles from '../Settings.module.css';

export const TransactionCaptureSection: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const pendingItems = useCapturedStore((state) => state.pendingItems);
  const lastCleanupBackup = useCapturedStore((state) => state.lastCleanupBackup);
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  const merchantCount = Object.keys(settings.merchantCategoryMap || {}).length;

  const refresh = useCallback(async () => {
    if (!transactionCaptureService.isNative()) {
      setChecking(false);
      return;
    }
    try {
      setEnabled((await transactionCaptureService.getStatus()).enabled);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void refresh();
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [refresh]);

  const handleCleanup = () => {
    setCleaning(true);
    try {
      const { removedExpenses, removedIncomes } = cleanupCorruptedTransactions();
      const total = removedExpenses + removedIncomes;
      if (total > 0) {
        useUiStore
          .getState()
          .addToast(`Cleaned ${total} invalid chat / promo / duplicate notification entry${total === 1 ? '' : 's'}`, 'success');
      } else {
        useUiStore.getState().addToast('No duplicate or invalid notification transactions found', 'info');
      }
    } finally {
      setCleaning(false);
    }
  };

  const handleClearMerchantRules = () => {
    updateSettings({ merchantCategoryMap: {} });
    useUiStore.getState().addToast('Cleared remembered merchant categories', 'info');
  };

  const toggleAutoImport = () => {
    const current = Boolean(settings.autoImportHighConfidence);
    updateSettings({ autoImportHighConfidence: !current });
    useUiStore
      .getState()
      .addToast(
        !current
          ? 'Auto-import enabled for high-confidence payments'
          : 'All captured payments will now go to Review queue first',
        'info'
      );
  };

  if (!transactionCaptureService.isNative()) return null;

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Automatic payment capture</h2>

      {/* Notification Access */}
      <div className={styles.settingCard}>
        <div className={styles.settingInfo}>
          <div className={styles.settingIconWrapper} aria-hidden="true">
            <span style={{ fontSize: 18 }}>📲</span>
          </div>
          <div>
            <h3 className={styles.settingName}>Read payment notifications</h3>
            <p className={styles.settingDesc}>
              {checking
                ? 'Checking Android access…'
                : enabled
                ? 'Active. Eligible UPI & bank payment alerts will be captured locally when received.'
                : 'Off. Enable Android notification-listener access to capture supported UPI & bank alerts.'}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={enabled ? 'secondary' : 'primary'}
          disabled={checking}
          onClick={() => void transactionCaptureService.openAccessSettings()}
        >
          {enabled ? 'Settings' : 'Enable'}
        </Button>
      </div>

      {/* Review Queue */}
      <div className={styles.settingCard} style={{ marginTop: '12px' }}>
        <div className={styles.settingInfo}>
          <div className={styles.settingIconWrapper} aria-hidden="true">
            <span style={{ fontSize: 18 }}>📋</span>
          </div>
          <div>
            <h3 className={styles.settingName}>Review captured transactions</h3>
            <p className={styles.settingDesc}>
              {pendingItems.length > 0
                ? `${pendingItems.length} transaction${pendingItems.length === 1 ? '' : 's'} waiting for your approval.`
                : 'No pending alerts waiting for review.'}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={pendingItems.length > 0 ? 'primary' : 'secondary'}
          onClick={() => setIsReviewOpen(true)}
        >
          {pendingItems.length > 0 ? `Review (${pendingItems.length})` : 'View queue'}
        </Button>
      </div>

      {/* Auto-import High Confidence Toggle */}
      <div className={styles.settingCard} style={{ marginTop: '12px' }}>
        <div className={styles.settingInfo}>
          <div className={styles.settingIconWrapper} aria-hidden="true">
            <span style={{ fontSize: 18 }}>⚡</span>
          </div>
          <div>
            <h3 className={styles.settingName}>Auto-import confident payments</h3>
            <p className={styles.settingDesc}>
              {settings.autoImportHighConfidence
                ? 'High-confidence alerts are saved directly. Low-confidence, refunds, reversals, and possible duplicates will always wait in Review.'
                : 'Off (recommended): All alerts wait in the Review queue so you can confirm payee, amount, and category before saving.'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 4 }}>
              High-confidence requires: positive proof of completed debit/credit, unambiguous amount, clear payee, and no duplicate flags.
            </p>
          </div>
        </div>
        <button
          type="button"
          className={`${styles.toggleBtn} ${settings.autoImportHighConfidence ? styles.toggleActive : ''}`}
          onClick={toggleAutoImport}
          aria-label="Toggle auto-import high confidence payments"
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>

      {/* Remembered Merchant Rules */}
      {merchantCount > 0 && (
        <div className={styles.settingCard} style={{ marginTop: '12px' }}>
          <div className={styles.settingInfo}>
            <div className={styles.settingIconWrapper} aria-hidden="true">
              <span style={{ fontSize: 18 }}>🏷️</span>
            </div>
            <div>
              <h3 className={styles.settingName}>Remembered merchants</h3>
              <p className={styles.settingDesc}>
                {merchantCount} merchant rule{merchantCount === 1 ? '' : 's'} saved for auto-categorization.
              </p>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={handleClearMerchantRules}>
            Reset rules
          </Button>
        </div>
      )}

      {/* Cleanup Corrupted / Chat / Promo Entries */}
      <div className={styles.settingCard} style={{ marginTop: '12px' }}>
        <div className={styles.settingInfo}>
          <div className={styles.settingIconWrapper} aria-hidden="true">
            <span style={{ fontSize: 18 }}>🧹</span>
          </div>
          <div>
            <h3 className={styles.settingName}>Clean promo & duplicate errors</h3>
            <p className={styles.settingDesc}>
              Safely removes only verified invalid chat/photo counters and promotional cashback alerts. Legitimate same-amount payments are never deleted.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {lastCleanupBackup && (lastCleanupBackup.expenses.length > 0 || lastCleanupBackup.incomes.length > 0) && (
            <Button size="sm" variant="secondary" onClick={() => undoCleanup()}>
              Undo cleanup
            </Button>
          )}
          <Button size="sm" variant="secondary" disabled={cleaning} onClick={handleCleanup}>
            {cleaning ? 'Cleaning…' : 'Clean now'}
          </Button>
        </div>
      </div>

      <p className={styles.notificationWarning}>
        <strong>Privacy notice:</strong> This feature works strictly by reading system payment notifications on-device. It does not read bank accounts or UPI history directly. All processing and storage stay 100% on your device. Chat apps like WhatsApp and promotional offers are excluded.
      </p>

      {/* Review Modal */}
      <ReviewCapturedModal isOpen={isReviewOpen} onClose={() => setIsReviewOpen(false)} />
    </div>
  );
};

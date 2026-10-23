import React, { useCallback, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import Button from '../../components/ui/Button';
import { transactionCaptureService } from '../../services/transactionCaptureService';
import styles from '../Settings.module.css';

export const TransactionCaptureSection: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const refresh = useCallback(async () => {
    if (!transactionCaptureService.isNative()) { setChecking(false); return; }
    try { setEnabled((await transactionCaptureService.getStatus()).enabled); }
    finally { setChecking(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => { if (isActive) void refresh(); });
    return () => { void listener.then((handle) => handle.remove()); };
  }, [refresh]);

  if (!transactionCaptureService.isNative()) return null;
  return <div className={styles.section}>
    <h2 className={styles.sectionTitle}>Automatic payment capture</h2>
    <div className={styles.settingCard}>
      <div className={styles.settingInfo}>
        <div className={styles.settingIconWrapper} aria-hidden="true"><span style={{ fontSize: 18 }}>📲</span></div>
        <div>
          <h3 className={styles.settingName}>Read payment notifications</h3>
          <p className={styles.settingDesc}>{checking ? 'Checking Android access…' : enabled ? 'Enabled. Matching outgoing payment alerts will be added automatically when you open the app.' : 'Off. Enable Android notification access once to capture supported UPI and bank payment alerts.'}</p>
        </div>
      </div>
      <Button size="sm" variant={enabled ? 'secondary' : 'primary'} disabled={enabled || checking} onClick={() => void transactionCaptureService.openAccessSettings()}>
        {enabled ? 'Enabled' : 'Enable on Android'}
      </Button>
    </div>
    <p className={styles.notificationWarning}>Android will ask you to approve notification access in system settings. Payment alerts are queued on this device and imported without per-payment confirmation; no notification data is sent to a server. Some apps hide transaction details or use formats this parser cannot recognize.</p>
  </div>;
};

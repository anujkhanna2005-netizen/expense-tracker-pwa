import React from 'react';
import Button from '../../components/ui/Button';
import styles from '../Settings.module.css';

interface NotificationSectionProps {
  notificationPermission: NotificationPermission;
  handleRequestNotificationPermission: () => void;
}

export const NotificationSection: React.FC<NotificationSectionProps> = ({
  notificationPermission,
  handleRequestNotificationPermission
}) => {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Notifications</h2>
      <div className={styles.settingCard}>
        <div className={styles.settingInfo}>
          <div className={styles.settingIconWrapper} aria-hidden="true">
            <span style={{ fontSize: '18px' }}>🔔</span>
          </div>
          <div>
            <h3 className={styles.settingName}>Bill Reminders</h3>
            <p className={styles.settingDesc}>
              {notificationPermission === 'granted'
                ? 'Local reminders are enabled'
                : 'Get notified of bills due within 3 days'}
            </p>
          </div>
        </div>
        <Button
          variant={notificationPermission === 'granted' ? 'secondary' : 'primary'}
          size="sm"
          onClick={handleRequestNotificationPermission}
          disabled={notificationPermission === 'granted'}
        >
          {notificationPermission === 'granted' ? 'Enabled' : 'Enable'}
        </Button>
      </div>
      <p className={styles.notificationWarning}>
        ⚠️ <strong>Note:</strong> Bill reminders only trigger while the PWA is open on your device.
        There is no backend server, so true offline background push notifications are not supported.
      </p>
    </div>
  );
};

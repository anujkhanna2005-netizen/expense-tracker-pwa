import React from 'react';
import { Shield } from 'lucide-react';
import Toggle from '../../components/ui/Toggle';
import type { Settings as SettingsType } from '../../types';
import styles from '../Settings.module.css';

interface SecuritySectionProps {
  settings: SettingsType;
  handleSecurityToggle: () => void;
}

export const SecuritySection: React.FC<SecuritySectionProps> = ({
  settings,
  handleSecurityToggle
}) => {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Security</h2>
      <div className={styles.settingCard}>
        <div className={styles.settingInfo}>
          <div className={styles.settingIconWrapper} aria-hidden="true">
            <Shield size={20} />
          </div>
          <div>
            <h3 className={styles.settingName}>PIN Lock & Encryption</h3>
            <p className={styles.settingDesc}>Protect and encrypt your local data with a secure PIN</p>
          </div>
        </div>
        <Toggle
          checked={settings.pinEnabled || false}
          onChange={handleSecurityToggle}
          ariaLabel="Toggle PIN Lock security"
        />
      </div>
      <p className={styles.notificationWarning} style={{ marginTop: '12px' }}>
        🔒 <strong>Local Device Lock:</strong> This encrypts your local database at rest. It does not secure against keyloggers or anyone who knows your device password, nor does it secure memory while the browser is currently unlocked and open.
      </p>
    </div>
  );
};

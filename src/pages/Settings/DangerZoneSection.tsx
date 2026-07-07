import React from 'react';
import { RotateCcw } from 'lucide-react';
import Button from '../../components/ui/Button';
import styles from '../Settings.module.css';

interface DangerZoneSectionProps {
  handleReset: () => void;
}

export const DangerZoneSection: React.FC<DangerZoneSectionProps> = ({
  handleReset
}) => {
  return (
    <div className={styles.section}>
      <h2 className={`${styles.sectionTitle} ${styles.dangerText}`}>Danger Zone</h2>
      
      <div className={styles.settingCard}>
        <div className={styles.settingInfo}>
          <div className={`${styles.settingIconWrapper} ${styles.dangerIcon}`} aria-hidden="true">
            <RotateCcw size={20} />
          </div>
          <div>
            <h3 className={styles.settingName}>Reset Data</h3>
            <p className={styles.settingDesc}>Permanently delete all your expenses and settings</p>
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={handleReset}>
          Reset Everything
        </Button>
      </div>
    </div>
  );
};

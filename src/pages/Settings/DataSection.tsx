import React from 'react';
import { Download, Upload, FileJson, FileText } from 'lucide-react';
import Button from '../../components/ui/Button';
import styles from '../Settings.module.css';

interface DataSectionProps {
  handleExportJSON: () => void;
  handleExportCSV: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const DataSection: React.FC<DataSectionProps> = ({
  handleExportJSON,
  handleExportCSV,
  fileInputRef,
  handleImportJSON
}) => {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Data & Backup</h2>
      
      <div className={styles.settingCard}>
        <div className={styles.settingInfo}>
          <div className={styles.settingIconWrapper} aria-hidden="true">
            <Download size={20} />
          </div>
          <div>
            <h3 className={styles.settingName}>Export Backup (JSON)</h3>
            <p className={styles.settingDesc}>Save all your data to a JSON file</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" icon={<FileJson size={14} />} onClick={handleExportJSON}>
          Export JSON
        </Button>
      </div>

      <div className={styles.settingCard}>
        <div className={styles.settingInfo}>
          <div className={styles.settingIconWrapper} aria-hidden="true">
            <Download size={20} />
          </div>
          <div>
            <h3 className={styles.settingName}>Export Expenses (CSV)</h3>
            <p className={styles.settingDesc}>Download expenses as a spreadsheet-ready CSV</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" icon={<FileText size={14} />} onClick={handleExportCSV}>
          Export CSV
        </Button>
      </div>

      <div className={styles.settingCard}>
        <div className={styles.settingInfo}>
          <div className={styles.settingIconWrapper} aria-hidden="true">
            <Upload size={20} />
          </div>
          <div>
            <h3 className={styles.settingName}>Import Backup</h3>
            <p className={styles.settingDesc}>Restore your data from a JSON file</p>
          </div>
        </div>
        <input 
          type="file" 
          accept=".json" 
          ref={fileInputRef} 
          onChange={handleImportJSON} 
          style={{ display: 'none' }} 
        />
        <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={() => fileInputRef.current?.click()}>
          Import
        </Button>
      </div>
    </div>
  );
};

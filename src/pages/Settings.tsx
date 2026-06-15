import React, { useRef, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Moon, Sun, Download, Upload, RotateCcw, Tags, FileJson } from 'lucide-react';
import ManageCategoriesModal from '../components/ManageCategoriesModal';
import styles from './Settings.module.css';

const Settings: React.FC = () => {
  const { settings, updateSettings, resetData, expenses, categories, bills, goals } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isManageCatsOpen, setIsManageCatsOpen] = useState(false);

  const toggleDarkMode = () => {
    updateSettings({ darkMode: !settings.darkMode });
  };

  const handleExportJSON = () => {
    const data = {
      expenses,
      categories,
      bills,
      goals,
      settings,
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        if (data.expenses && data.categories) {
          if (window.confirm('This will overwrite your current data. Proceed?')) {
            // For a robust implementation, we would validate and merge.
            // For this minimal app, we just overwrite localforage directly and reload.
            import('localforage').then(localforage => {
              Promise.all([
                localforage.default.setItem('expenses', data.expenses),
                localforage.default.setItem('categories', data.categories),
                localforage.default.setItem('bills', data.bills || []),
                localforage.default.setItem('goals', data.goals || []),
                localforage.default.setItem('settings', data.settings || settings),
              ]).then(() => {
                alert('Data imported successfully! The app will now reload.');
                window.location.reload();
              });
            });
          }
        } else {
          alert('Invalid backup file format.');
        }
      } catch (err) {
        console.error(err);
        alert('Error parsing JSON file.');
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you absolutely sure? This will delete all your data permanently.')) {
      if (window.confirm('Please confirm one more time. This CANNOT be undone.')) {
        resetData();
        alert('All data has been reset.');
      }
    }
  };

  return (
    <div className={styles.settingsContainer}>
      <header className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your app preferences and data</p>
      </header>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Preferences</h2>
        <div className={styles.settingCard}>
          <div className={styles.settingInfo}>
            <div className={styles.settingIconWrapper}>
              {settings.darkMode ? <Moon size={20} /> : <Sun size={20} />}
            </div>
            <div>
              <h3 className={styles.settingName}>Dark Mode</h3>
              <p className={styles.settingDesc}>Toggle between light and dark themes</p>
            </div>
          </div>
          <button 
            className={`${styles.toggleBtn} ${settings.darkMode ? styles.toggleActive : ''}`}
            onClick={toggleDarkMode}
            aria-pressed={settings.darkMode}
          >
            <div className={styles.toggleKnob} />
          </button>
        </div>

        <div className={styles.settingCard}>
          <div className={styles.settingInfo}>
            <div className={styles.settingIconWrapper}>
              <Tags size={20} />
            </div>
            <div>
              <h3 className={styles.settingName}>Manage Categories</h3>
              <p className={styles.settingDesc}>Add, edit, or remove expense categories</p>
            </div>
          </div>
          <button className={styles.actionBtn} onClick={() => setIsManageCatsOpen(true)}>
            Manage
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Data & Backup</h2>
        
        <div className={styles.settingCard}>
          <div className={styles.settingInfo}>
            <div className={styles.settingIconWrapper}>
              <Download size={20} />
            </div>
            <div>
              <h3 className={styles.settingName}>Export Backup</h3>
              <p className={styles.settingDesc}>Save your data to a JSON file</p>
            </div>
          </div>
          <button className={styles.actionBtn} onClick={handleExportJSON}>
            <FileJson size={16} style={{marginRight: '6px'}} />
            Export
          </button>
        </div>

        <div className={styles.settingCard}>
          <div className={styles.settingInfo}>
            <div className={styles.settingIconWrapper}>
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
          <button className={styles.actionBtn} onClick={() => fileInputRef.current?.click()}>
            Import
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={`${styles.sectionTitle} ${styles.dangerText}`}>Danger Zone</h2>
        
        <div className={styles.settingCard}>
          <div className={styles.settingInfo}>
            <div className={`${styles.settingIconWrapper} ${styles.dangerIcon}`}>
              <RotateCcw size={20} />
            </div>
            <div>
              <h3 className={styles.settingName}>Reset Data</h3>
              <p className={styles.settingDesc}>Permanently delete all your expenses and settings</p>
            </div>
          </div>
          <button className={styles.dangerBtn} onClick={handleReset}>
            Reset Everything
          </button>
        </div>
      </div>
      
      <div className={styles.footerInfo}>
        <p>Expense Tracker App v1.0.0</p>
        <p className={styles.privacyBadge}>🔒 Your data never leaves your device.</p>
      </div>

      <ManageCategoriesModal 
        isOpen={isManageCatsOpen} 
        onClose={() => setIsManageCatsOpen(false)} 
      />
    </div>
  );
};

export default Settings;

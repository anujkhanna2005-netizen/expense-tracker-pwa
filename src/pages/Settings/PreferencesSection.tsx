import React from 'react';
import { Moon, Sun, Tags } from 'lucide-react';
import Toggle from '../../components/ui/Toggle';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import CategoryBudgetManager from '../../components/CategoryBudgetManager';
import type { Settings } from '../../types';
import styles from '../Settings.module.css';

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD - US Dollar ($)' },
  { value: 'EUR', label: 'EUR - Euro (€)' },
  { value: 'GBP', label: 'GBP - British Pound (£)' },
  { value: 'INR', label: 'INR - Indian Rupee (₹)' },
  { value: 'JPY', label: 'JPY - Japanese Yen (¥)' },
  { value: 'CAD', label: 'CAD - Canadian Dollar (CA$)' },
  { value: 'AUD', label: 'AUD - Australian Dollar (A$)' },
];

interface PreferencesSectionProps {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => boolean;
  toggleDarkMode: () => void;
  setIsManageCatsOpen: (open: boolean) => void;
  setIsSetBudgetOpen: (open: boolean) => void;
}

export const PreferencesSection: React.FC<PreferencesSectionProps> = ({
  settings,
  updateSettings,
  toggleDarkMode,
  setIsManageCatsOpen,
  setIsSetBudgetOpen
}) => {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Preferences</h2>

      <div className={styles.settingCard}>
        <div className={styles.settingInfo}>
          <div className={styles.settingIconWrapper} aria-hidden="true">
            {settings.darkMode ? <Moon size={20} /> : <Sun size={20} />}
          </div>
          <div>
            <h3 className={styles.settingName}>Dark Mode</h3>
            <p className={styles.settingDesc}>Toggle between light and dark themes</p>
          </div>
        </div>
        <Toggle
          checked={settings.darkMode}
          onChange={toggleDarkMode}
          ariaLabel="Toggle dark mode"
        />
      </div>

      <div className={styles.settingCard}>
        <div className={styles.settingInfo}>
          <div className={styles.settingIconWrapper} aria-hidden="true">
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>$</span>
          </div>
          <div>
            <h3 className={styles.settingName}>Currency</h3>
            <p className={styles.settingDesc}>Choose your preferred currency</p>
          </div>
        </div>
        <div style={{ minWidth: '220px' }}>
          <Select
            value={settings.currency}
            options={CURRENCY_OPTIONS}
            onChange={(val) => updateSettings({ currency: val })}
          />
        </div>
      </div>

      <div className={styles.settingCard}>
        <div className={styles.settingInfo}>
          <div className={styles.settingIconWrapper} aria-hidden="true">
            <Tags size={20} />
          </div>
          <div>
            <h3 className={styles.settingName}>Manage Categories</h3>
            <p className={styles.settingDesc}>Add, edit, or remove expense categories</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setIsManageCatsOpen(true)}>
          Manage
        </Button>
      </div>

      <div className={styles.settingCard}>
        <div className={styles.settingInfo}>
          <div className={styles.settingIconWrapper} aria-hidden="true">
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>📊</span>
          </div>
          <div>
            <h3 className={styles.settingName}>Monthly Budget</h3>
            <p className={styles.settingDesc}>Set your monthly spending limit</p>
          </div>
        </div>
        <Button 
          variant="secondary"
          size="sm"
          onClick={() => setIsSetBudgetOpen(true)}
        >
          {settings.monthlyBudgetLimit ? `${settings.currency} ${settings.monthlyBudgetLimit}` : 'Set Budget'}
        </Button>
      </div>

      <CategoryBudgetManager />
    </div>
  );
};

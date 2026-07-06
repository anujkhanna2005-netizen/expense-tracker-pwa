import React, { useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { Moon, Sun, Download, Upload, RotateCcw, Tags, FileJson, FileText } from 'lucide-react';
import ManageCategoriesModal from '../components/ManageCategoriesModal';
import SetBudgetModal from '../components/SetBudgetModal';
import ConfirmModal from '../components/ConfirmModal';
import Select from '../components/ui/Select';
import Toggle from '../components/ui/Toggle';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/ToastProvider';
import styles from './Settings.module.css';
import { useState } from 'react';

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD - US Dollar ($)' },
  { value: 'EUR', label: 'EUR - Euro (€)' },
  { value: 'GBP', label: 'GBP - British Pound (£)' },
  { value: 'INR', label: 'INR - Indian Rupee (₹)' },
  { value: 'JPY', label: 'JPY - Japanese Yen (¥)' },
  { value: 'CAD', label: 'CAD - Canadian Dollar (CA$)' },
  { value: 'AUD', label: 'AUD - Australian Dollar (A$)' },
];

const Settings: React.FC = () => {
  const { settings, updateSettings, resetData, importData, expenses, categories, bills, goals } = useData();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isManageCatsOpen, setIsManageCatsOpen] = useState(false);
  const [isSetBudgetOpen, setIsSetBudgetOpen] = useState(false);

  const [importDataPending, setImportDataPending] = useState<any>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showResetConfirm1, setShowResetConfirm1] = useState(false);
  const [showResetConfirm2, setShowResetConfirm2] = useState(false);

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
    toast('JSON backup exported successfully!', 'success');
  };

  const handleExportCSV = () => {
    const headers = ['date', 'category', 'amount', 'paymentMethod', 'notes'];
    const rows = expenses.map(exp => {
      const cat = categories.find(c => c.id === exp.categoryId);
      return [
        exp.date,
        cat?.name || '',
        exp.amount.toString(),
        exp.paymentMethod,
        (exp.notes || '').replace(/,/g, ';').replace(/\n/g, ' ')
      ];
    });
    const csvContent = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`CSV exported — ${expenses.length} transactions`, 'success');
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
          setImportDataPending(data);
          setShowImportConfirm(true);
        } else {
          toast('Invalid backup file format.', 'error');
        }
      } catch (err) {
        console.error(err);
        toast('Error parsing JSON file.', 'error');
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (importDataPending) {
      await importData({
        expenses: importDataPending.expenses,
        categories: importDataPending.categories,
        bills: importDataPending.bills || [],
        goals: importDataPending.goals || [],
        settings: importDataPending.settings || settings,
      });
      setShowImportConfirm(false);
      setImportDataPending(null);
      toast('Data imported successfully!', 'success');
    }
  };

  const handleReset = () => {
    setShowResetConfirm1(true);
  };

  const handleResetConfirm1 = () => {
    setShowResetConfirm1(false);
    setShowResetConfirm2(true);
  };

  const handleResetConfirm2 = () => {
    setShowResetConfirm2(false);
    resetData();
    toast('All data has been reset.', 'info');
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
      </div>

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
      
      <div className={styles.footerInfo}>
        <p>Expense Tracker App v1.0.0</p>
        <p className={styles.privacyBadge}><span aria-hidden="true">🔒</span> Your data never leaves your device.</p>
      </div>

      <ManageCategoriesModal 
        isOpen={isManageCatsOpen} 
        onClose={() => setIsManageCatsOpen(false)} 
      />

      <SetBudgetModal
        isOpen={isSetBudgetOpen}
        onClose={() => setIsSetBudgetOpen(false)}
      />

      <ConfirmModal
        isOpen={showImportConfirm}
        title="Confirm Import"
        message="This will overwrite your current data. Proceed?"
        confirmText="Overwrite"
        onConfirm={handleConfirmImport}
        onCancel={() => { setShowImportConfirm(false); setImportDataPending(null); }}
      />

      <ConfirmModal
        isOpen={showResetConfirm1}
        title="Reset Data"
        message="Are you absolutely sure? This will delete all your data permanently."
        confirmText="Continue"
        onConfirm={handleResetConfirm1}
        onCancel={() => setShowResetConfirm1(false)}
      />

      <ConfirmModal
        isOpen={showResetConfirm2}
        title="Confirm Reset"
        message="Please confirm one more time. This CANNOT be undone."
        confirmText="Reset Everything"
        onConfirm={handleResetConfirm2}
        onCancel={() => setShowResetConfirm2(false)}
      />
    </div>
  );
};

export default Settings;

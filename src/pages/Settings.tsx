import React, { useRef, useState } from 'react';
import { Moon, Sun, Download, Upload, RotateCcw, Tags, FileJson, FileText, Shield } from 'lucide-react';
import ManageCategoriesModal from '../components/ManageCategoriesModal';
import SetBudgetModal from '../components/SetBudgetModal';
import ConfirmModal from '../components/ConfirmModal';
import CategoryBudgetManager from '../components/CategoryBudgetManager';
import Modal from '../components/ui/Modal';
import { encryptionService } from '../services/encryptionService';
import Select from '../components/ui/Select';
import Toggle from '../components/ui/Toggle';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/ToastProvider';
import { useExpenses } from '../hooks/useExpenses';
import { useCategories } from '../hooks/useCategories';
import { useBills } from '../hooks/useBills';
import { useGoals } from '../hooks/useGoals';
import { useSettings } from '../hooks/useSettings';
import { useIncome } from '../hooks/useIncome';
import { useExpenseStore } from '../stores/expenseStore';
import { useCategoryStore } from '../stores/categoryStore';
import { useBillStore } from '../stores/billStore';
import { useGoalStore } from '../stores/goalStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useIncomeStore } from '../stores/incomeStore';
import { importDataSchema } from '../utils/validation';
import { storageService } from '../services/storageService';
import { notificationService } from '../services/notificationService';
import styles from './Settings.module.css';

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
  const { expenses } = useExpenses();
  const { categories } = useCategories();
  const { bills } = useBills();
  const { goals } = useGoals();
  const { settings, updateSettings } = useSettings();
  const { incomes } = useIncome();
  const { toast } = useToast();

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return 'Notification' in window ? Notification.permission : 'denied';
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isManageCatsOpen, setIsManageCatsOpen] = useState(false);
  const [isSetBudgetOpen, setIsSetBudgetOpen] = useState(false);

  const [importDataPending, setImportDataPending] = useState<any>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showResetConfirm1, setShowResetConfirm1] = useState(false);
  const [showResetConfirm2, setShowResetConfirm2] = useState(false);

  // Security lock state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [confirmPinValue, setConfirmPinValue] = useState('');
  const [currentPinValue, setCurrentPinValue] = useState('');
  const [pinSetupStep, setPinSetupStep] = useState<'verify' | 'set' | 'confirm'>('set');
  const [isDisablingPin, setIsDisablingPin] = useState(false);

  const handleSecurityToggle = () => {
    if (settings.pinEnabled) {
      setPinSetupStep('verify');
      setPinValue('');
      setCurrentPinValue('');
      setIsDisablingPin(true);
      setIsPinModalOpen(true);
    } else {
      setPinSetupStep('set');
      setPinValue('');
      setConfirmPinValue('');
      setIsDisablingPin(false);
      setIsPinModalOpen(true);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pinSetupStep === 'verify') {
      if (!settings.pinSalt || !settings.pinHash) {
        toast('Security state is corrupted. Please reset app data.', 'error');
        return;
      }
      const hash = await encryptionService.derivePinHash(currentPinValue, settings.pinSalt);
      if (hash !== settings.pinHash) {
        toast('Incorrect PIN', 'error');
        return;
      }

      if (isDisablingPin) {
        const nextSuccess = updateSettings({ pinEnabled: false, pinHash: undefined, pinSalt: undefined });
        if (nextSuccess) {
          await storageService.set('expenses', useExpenseStore.getState().expenses);
          await storageService.set('categories', useCategoryStore.getState().categories);
          await storageService.set('bills', useBillStore.getState().bills);
          await storageService.set('goals', useGoalStore.getState().goals);
          await storageService.set('incomes', useIncomeStore.getState().incomes);
          encryptionService.setSessionKey(null);
          toast('PIN lock and encryption disabled successfully.', 'success');
        }
        setIsPinModalOpen(false);
      } else {
        setPinSetupStep('set');
        setPinValue('');
        setConfirmPinValue('');
      }
    } else if (pinSetupStep === 'set') {
      if (pinValue.length < 4 || pinValue.length > 6 || !/^\d+$/.test(pinValue)) {
        toast('PIN must be 4 to 6 numeric digits', 'error');
        return;
      }
      setPinSetupStep('confirm');
    } else if (pinSetupStep === 'confirm') {
      if (pinValue !== confirmPinValue) {
        toast('PINs do not match. Please try again.', 'error');
        setPinSetupStep('set');
        setPinValue('');
        setConfirmPinValue('');
        return;
      }

      const salt = encryptionService.generateSalt();
      const hash = await encryptionService.derivePinHash(pinValue, salt);
      await encryptionService.deriveSessionKey(pinValue, salt);

      const nextSuccess = updateSettings({
        pinEnabled: true,
        pinHash: hash,
        pinSalt: salt
      });

      if (nextSuccess) {
        await storageService.set('expenses', useExpenseStore.getState().expenses);
        await storageService.set('categories', useCategoryStore.getState().categories);
        await storageService.set('bills', useBillStore.getState().bills);
        await storageService.set('goals', useGoalStore.getState().goals);
        await storageService.set('incomes', useIncomeStore.getState().incomes);
        toast('PIN lock and encryption enabled successfully.', 'success');
      }

      setIsPinModalOpen(false);
    }
  };

  const toggleDarkMode = () => {
    updateSettings({ darkMode: !settings.darkMode });
  };

  const handleExportJSON = () => {
    const data = {
      expenses,
      categories,
      bills,
      goals,
      incomes,
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
    const expenseHeaders = ['type', 'date', 'category_or_source', 'amount', 'paymentMethod_or_frequency', 'notes'];
    const expenseRows = expenses.map(exp => {
      const cat = categories.find(c => c.id === exp.categoryId);
      return [
        'expense',
        exp.date,
        cat?.name || '',
        exp.amount.toString(),
        exp.paymentMethod,
        (exp.notes || '').replace(/,/g, ';').replace(/\n/g, ' ')
      ];
    });
    const incomeRows = incomes.map(inc => [
      'income',
      inc.date,
      inc.source,
      inc.amount.toString(),
      inc.isRecurring ? (inc.recurringFrequency || '') : '',
      (inc.notes || '').replace(/,/g, ';').replace(/\n/g, ' ')
    ]);
    const allRows = [...expenseRows, ...incomeRows].sort((a, b) => a[1].localeCompare(b[1]));
    const csvContent = [expenseHeaders, ...allRows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`CSV exported — ${expenses.length} expenses + ${incomes.length} income entries`, 'success');
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        // Quick basic structure check before prompting confirm modal
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
      const validation = importDataSchema.safeParse(importDataPending);
      if (!validation.success) {
        const errMsg = validation.error.issues[0]?.message || 'Invalid backup format';
        toast(errMsg, 'error');
        return;
      }

      const data = validation.data;
      if (data.expenses) useExpenseStore.getState().setExpenses(data.expenses);
      if (data.categories) useCategoryStore.getState().setCategories(data.categories);
      if (data.bills) useBillStore.getState().setBills(data.bills);
      if (data.goals) useGoalStore.getState().setGoals(data.goals);
      if (data.incomes) useIncomeStore.getState().setIncomes(data.incomes);
      if (data.settings) useSettingsStore.getState().updateSettings(data.settings);

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

  const handleResetConfirm2 = async () => {
    setShowResetConfirm2(false);
    await storageService.clear();

    useExpenseStore.getState().resetExpenses();
    useCategoryStore.getState().resetCategories();
    useBillStore.getState().resetBills();
    useGoalStore.getState().resetGoals();
    useIncomeStore.getState().resetIncomes();
    useSettingsStore.getState().resetSettings();

    toast('All data has been reset.', 'info');
  };

  const handleRequestNotificationPermission = async () => {
    const permission = await notificationService.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      toast('Notifications enabled! Reminders will show here.', 'success');
      // Trigger a test notification
      new Notification('Reminders Enabled! 📅', {
        body: 'You will receive local notifications for bills due soon while the app is open.',
        icon: '/icon-192.png'
      });
    } else {
      toast('Notification permission denied or unavailable.', 'error');
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

      <Modal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        title={
          pinSetupStep === 'verify'
            ? 'Verify Current PIN'
            : pinSetupStep === 'set'
            ? 'Set Security PIN'
            : 'Confirm Security PIN'
        }
        variant="dialog"
        accentColor="primary"
      >
        <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {pinSetupStep === 'verify' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label htmlFor="current-pin-input" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Enter your current PIN to authorize this action:
              </label>
              <input
                id="current-pin-input"
                type="password"
                maxLength={6}
                pattern="\d*"
                inputMode="numeric"
                value={currentPinValue}
                onChange={(e) => setCurrentPinValue(e.target.value.replace(/\D/g, ''))}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--surface-1)',
                  color: 'var(--text-primary)',
                  fontSize: '20px',
                  textAlign: 'center',
                  letterSpacing: '8px',
                  width: '100%'
                }}
                autoFocus
                required
              />
            </div>
          )}

          {pinSetupStep === 'set' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Create a 4 to 6 digit security PIN to protect your financial data.
              </p>
              <div style={{ padding: '10px', backgroundColor: 'var(--color-primary-soft)', border: '1px solid var(--color-primary)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', marginBottom: '8px' }}>
                ⚠️ <strong>WARNING:</strong> If you forget this PIN, your database is permanently unrecoverable. <strong>Consider exporting a JSON backup first.</strong>
              </div>
              <label htmlFor="new-pin-input" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Enter new PIN:
              </label>
              <input
                id="new-pin-input"
                type="password"
                maxLength={6}
                pattern="\d*"
                inputMode="numeric"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--surface-1)',
                  color: 'var(--text-primary)',
                  fontSize: '20px',
                  textAlign: 'center',
                  letterSpacing: '8px',
                  width: '100%'
                }}
                autoFocus
                required
              />
            </div>
          )}

          {pinSetupStep === 'confirm' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label htmlFor="confirm-pin-input" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Re-enter PIN to confirm:
              </label>
              <input
                id="confirm-pin-input"
                type="password"
                maxLength={6}
                pattern="\d*"
                inputMode="numeric"
                value={confirmPinValue}
                onChange={(e) => setConfirmPinValue(e.target.value.replace(/\D/g, ''))}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--surface-1)',
                  color: 'var(--text-primary)',
                  fontSize: '20px',
                  textAlign: 'center',
                  letterSpacing: '8px',
                  width: '100%'
                }}
                autoFocus
                required
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsPinModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {pinSetupStep === 'set' ? 'Continue' : 'Submit'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Settings;

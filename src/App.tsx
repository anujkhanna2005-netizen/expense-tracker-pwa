import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/ToastProvider';
import Skeleton from './components/ui/Skeleton';
import { useRecurring } from './hooks/useRecurring';
import { useBillStore } from './stores/billStore';
import { useExpenseStore } from './stores/expenseStore';
import { useCategoryStore } from './stores/categoryStore';
import { useGoalStore } from './stores/goalStore';
import { useIncomeStore } from './stores/incomeStore';
import { useUiStore } from './stores/uiStore';
import { useSettingsStore } from './stores/settingsStore';
import { useHydration } from './hooks/useHydration';
import { encryptionService } from './services/encryptionService';
import { notificationService } from './services/notificationService';
import PinLockScreen from './components/PinLockScreen';
import { App as CapacitorApp } from '@capacitor/app';
import { transactionCaptureService, cleanupCorruptedTransactions } from './services/transactionCaptureService';

// Lazy load route pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Bills = lazy(() => import('./pages/Bills'));
const Goals = lazy(() => import('./pages/Goals'));
const Settings = lazy(() => import('./pages/Settings'));
const Reports = lazy(() => import('./pages/Reports'));

function PageSkeleton() {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Skeleton variant="line" width="200px" height={32} />
      <Skeleton variant="card" height={150} />
      <Skeleton variant="card" height={250} />
    </div>
  );
}

/** Mounts once inside the Router to run side-effects that need routing context */
function AppEffects() {
  useRecurring();
  
  useEffect(() => {
    // Run bill reminders check on app load/mount
    const bills = useBillStore.getState().bills;
    notificationService.checkAndNotifyDueBills(bills);

    // Automatically purge any corrupt WhatsApp chat expenses or duplicate notification alerts
    const { removedExpenses, removedIncomes } = cleanupCorruptedTransactions();
    if (removedExpenses > 0 || removedIncomes > 0) {
      const total = removedExpenses + removedIncomes;
      useUiStore.getState().addToast(`Cleaned ${total} invalid chat / duplicate notification entry${total === 1 ? '' : 's'}`, 'info');
    }

    // Reconcile any test transactions imported with 2024 dates when running on 2026 system clock
    const currentYear = new Date().getFullYear().toString();
    if (currentYear === '2026') {
      const expStore = useExpenseStore.getState();
      if (expStore.expenses.some((e) => e.date.startsWith('2024-'))) {
        expStore.setExpenses(
          expStore.expenses.map((e) => (e.date.startsWith('2024-') ? { ...e, date: e.date.replace('2024-', '2026-') } : e))
        );
      }
      const incStore = useIncomeStore.getState();
      if (incStore.incomes.some((i) => i.date.startsWith('2024-'))) {
        incStore.setIncomes(
          incStore.incomes.map((i) => (i.date.startsWith('2024-') ? { ...i, date: i.date.replace('2024-', '2026-') } : i))
        );
      }
    }
  }, []);

  useEffect(() => {
    let syncing = false;
    const syncTransactions = async () => {
      if (syncing || !transactionCaptureService.isNative()) return;
      syncing = true;
      try {
        const { expenses, incomes, queuedForReview } = await transactionCaptureService.importPending(
          useCategoryStore.getState().categories,
          useExpenseStore.getState().addExpense,
          useIncomeStore.getState().addIncome,
        );
        if (queuedForReview > 0) {
          useUiStore.getState().addToast(`${queuedForReview} payment alert${queuedForReview === 1 ? '' : 's'} captured for review`, 'info');
        } else if (expenses > 0 && incomes > 0) {
          useUiStore.getState().addToast(`${expenses} expense${expenses === 1 ? '' : 's'} & ${incomes} income${incomes === 1 ? '' : 's'} added from notifications`, 'success');
        } else if (expenses > 0) {
          useUiStore.getState().addToast(`${expenses} payment${expenses === 1 ? '' : 's'} added from notifications`, 'success');
        } else if (incomes > 0) {
          useUiStore.getState().addToast(`${incomes} incoming payment${incomes === 1 ? '' : 's'} added to income`, 'success');
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error('Could not import captured notifications', error);
      } finally {
        syncing = false;
      }
    };
    void syncTransactions();
    const timer = setInterval(syncTransactions, 3000);
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void syncTransactions();
    });
    return () => {
      void listener.then((handle) => handle.remove());
      clearInterval(timer);
    };
  }, []);

  return null;
}

function App() {
  const hydrated = useHydration();
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return localStorage.getItem('pin_lock_enabled') !== 'true';
  });

  useEffect(() => {
    if (hydrated) {
      const settings = useSettingsStore.getState().settings;
      if (settings?.pinEnabled) {
        if (encryptionService.hasSessionKey()) {
          setIsUnlocked(true);
        } else {
          setIsUnlocked(false);
        }
      } else {
        setIsUnlocked(true);
      }
    }
  }, [hydrated]);

  const handleUnlock = async (pin: string): Promise<boolean> => {
    const settings = useSettingsStore.getState().settings;
    if (!settings.pinSalt || !settings.pinHash) return false;

    const hash = await encryptionService.derivePinHash(pin, settings.pinSalt);
    if (hash === settings.pinHash) {
      await encryptionService.deriveSessionKey(pin, settings.pinSalt);
      
      // Force re-hydration to load decrypted store states
      await useExpenseStore.persist.rehydrate();
      await useCategoryStore.persist.rehydrate();
      await useBillStore.persist.rehydrate();
      await useGoalStore.persist.rehydrate();
      await useIncomeStore.persist.rehydrate();

      setIsUnlocked(true);
      return true;
    }
    return false;
  };

  if (!hydrated) {
    return <PageSkeleton />;
  }

  if (!isUnlocked) {
    return (
      <ToastProvider>
        <PinLockScreen onUnlock={handleUnlock} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <Router>
        <AppEffects />
        <Layout>
          <ErrorBoundary>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/bills" element={<Bills />} />
                <Route path="/goals" element={<Goals />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Layout>
      </Router>
    </ToastProvider>
  );
}

export default App;

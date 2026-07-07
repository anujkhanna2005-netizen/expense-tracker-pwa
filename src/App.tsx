import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/ToastProvider';
import Skeleton from './components/ui/Skeleton';
import { useRecurring } from './hooks/useRecurring';
import { useBillStore } from './stores/billStore';
import { notificationService } from './services/notificationService';

// Lazy load route pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Bills = lazy(() => import('./pages/Bills'));
const Goals = lazy(() => import('./pages/Goals'));
const Settings = lazy(() => import('./pages/Settings'));
const StyleGuide = lazy(() => import('./pages/StyleGuide'));
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
  }, []);

  return null;
}

function App() {
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
                <Route path="/style-guide" element={<StyleGuide />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Layout>
      </Router>
    </ToastProvider>
  );
}

export default App;

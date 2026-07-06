import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/ToastProvider';
import Skeleton from './components/ui/Skeleton';

// Lazy load route pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Bills = lazy(() => import('./pages/Bills'));
const Goals = lazy(() => import('./pages/Goals'));
const Settings = lazy(() => import('./pages/Settings'));
const StyleGuide = lazy(() => import('./pages/StyleGuide'));

function PageSkeleton() {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Skeleton variant="line" width="200px" height={32} />
      <Skeleton variant="card" height={150} />
      <Skeleton variant="card" height={250} />
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <Router>
        <Layout>
          <ErrorBoundary>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/bills" element={<Bills />} />
                <Route path="/goals" element={<Goals />} />
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

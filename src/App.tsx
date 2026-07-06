import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Bills from './pages/Bills';
import Goals from './pages/Goals';
import Settings from './pages/Settings';
import StyleGuide from './pages/StyleGuide';
import { DataProvider } from './contexts/DataContext';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/ToastProvider';

function App() {
  return (
    <DataProvider>
      <ToastProvider>
        <Router>
          <Layout>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/bills" element={<Bills />} />
                <Route path="/goals" element={<Goals />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/style-guide" element={<StyleGuide />} />
              </Routes>
            </ErrorBoundary>
          </Layout>
        </Router>
      </ToastProvider>
    </DataProvider>
  );
}

export default App;

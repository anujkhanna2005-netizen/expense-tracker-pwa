import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ReceiptText, 
  CalendarClock, 
  Target, 
  Settings, 
  Plus, 
  TrendingUp, 
  BarChart2, 
  X,
  Bell 
} from 'lucide-react';
import QuickAddExpense from './QuickAddExpense';
import AddIncomeModal from './AddIncomeModal';
import { ReviewCapturedModal } from './ReviewCapturedModal';
import { useCapturedStore } from '../stores/capturedTransactionStore';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isQuickAddOpen, setIsQuickAddOpen] = React.useState(false);
  const [isAddIncomeOpen, setIsAddIncomeOpen] = React.useState(false);
  const [isFabMenuOpen, setIsFabMenuOpen] = React.useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = React.useState(false);
  const location = useLocation();

  const pendingItems = useCapturedStore((state) => state.pendingItems);

  React.useEffect(() => {
    const handleOpen = () => setIsQuickAddOpen(true);
    const handleOpenReview = () => setIsReviewModalOpen(true);
    window.addEventListener('openAddExpense', handleOpen);
    window.addEventListener('openReviewCaptured', handleOpenReview);
    return () => {
      window.removeEventListener('openAddExpense', handleOpen);
      window.removeEventListener('openReviewCaptured', handleOpenReview);
    };
  }, []);

  // Close FAB menu on route change
  React.useEffect(() => {
    setIsFabMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/expenses', label: 'Expenses', icon: ReceiptText },
    { path: '/bills', label: 'Bills', icon: CalendarClock },
    { path: '/goals', label: 'Goals', icon: Target },
    { path: '/reports', label: 'Reports', icon: BarChart2 },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/dashboard': return 'Dashboard';
      case '/expenses': return 'Expenses';
      case '/bills': return 'Bills';
      case '/goals': return 'Goals';
      case '/reports': return 'Reports';
      case '/settings': return 'Settings';
      default: return 'Overview';
    }
  };

  /** Routes where the FAB shows expense/income choice */
  const isExpenseIncomeRoute =
    location.pathname === '/dashboard' || location.pathname === '/expenses';

  const handleFabClick = () => {
    if (location.pathname === '/bills') {
      window.dispatchEvent(new Event('openAddBill'));
    } else if (location.pathname === '/goals') {
      window.dispatchEvent(new Event('openAddGoal'));
    } else if (isExpenseIncomeRoute) {
      setIsFabMenuOpen((prev) => !prev);
    } else {
      setIsQuickAddOpen(true);
    }
  };

  return (
    <div className={styles.layout}>
      {/* Skip to Content link for accessibility */}
      <a href="#main-content" className={styles.skipLink}>
        Skip to main content
      </a>

      {/* Top Header Bar */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerLogoIcon}>💰</div>
          <div className={styles.headerTitleGroup}>
            <span className={styles.headerBrand}>Expense Tracker</span>
            <span className={styles.headerSubtitle}>{getPageTitle()}</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.headerBellBtn}
            onClick={() => setIsReviewModalOpen(true)}
            aria-label="Pending UPI Notifications"
          >
            <Bell size={20} />
            {pendingItems.length > 0 && (
              <span className={styles.bellBadge}>
                <span className={styles.bellBadgePing} />
                <span className={styles.bellBadgeDot} />
              </span>
            )}
          </button>

          <NavLink to="/settings" className={styles.headerProfileBtn} aria-label="Profile Settings">
            <span className={styles.avatarCircle}>AK</span>
          </NavLink>
        </div>
      </header>

      {/* Sidebar for Desktop */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoIcon} aria-hidden="true">💰</span>
          <div>
            <h2>Expense Tracker</h2>
            <span className={styles.logoSubtext}>RupeeWise Emerald</span>
          </div>
        </div>
        
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <item.icon className={styles.icon} size={20} />
              <span>{item.label}</span>
              {item.path === '/dashboard' && pendingItems.length > 0 && (
                <span className={styles.sidebarBadge}>{pendingItems.length}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main id="main-content" className={styles.mainContent}>
        <div className={styles.pageContainer}>
          {children}
        </div>
      </main>

      {/* Floating Action Button (Centered above mobile bottom bar) */}
      {location.pathname !== '/settings' && (
        <div className={styles.fabWrapper}>
          {/* Popover menu for expense/income choice */}
          {isFabMenuOpen && isExpenseIncomeRoute && (
            <>
              <div
                className={styles.fabBackdrop}
                onClick={() => setIsFabMenuOpen(false)}
                aria-hidden="true"
              />
              <div className={styles.fabMenu} role="menu" aria-label="Add action">
                <button
                  className={styles.fabMenuItem}
                  role="menuitem"
                  onClick={() => {
                    setIsFabMenuOpen(false);
                    setIsAddIncomeOpen(true);
                  }}
                >
                  <span className={styles.fabMenuItemIcon} style={{ background: 'var(--color-mint-highlight)', color: 'var(--status-income)' }}>
                    <TrendingUp size={18} />
                  </span>
                  <span>Add Income</span>
                </button>
                <button
                  className={styles.fabMenuItem}
                  role="menuitem"
                  onClick={() => {
                    setIsFabMenuOpen(false);
                    setIsQuickAddOpen(true);
                  }}
                >
                  <span className={styles.fabMenuItemIcon} style={{ background: 'var(--surface-container-high)', color: 'var(--color-primary-container)' }}>
                    <ReceiptText size={18} />
                  </span>
                  <span>Add Expense</span>
                </button>
              </div>
            </>
          )}

          <button
            className={`${styles.fab} ${isFabMenuOpen ? styles.fabOpen : ''}`}
            onClick={handleFabClick}
            aria-label={isFabMenuOpen ? 'Close menu' : 'Add Transaction'}
            aria-expanded={isFabMenuOpen}
          >
            {isFabMenuOpen ? <X size={26} /> : <Plus size={26} />}
          </button>
        </div>
      )}

      {/* Bottom Navigation for Mobile (5-slot layout with center FAB slot) */}
      <nav className={styles.bottomNav}>
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `${styles.bottomNavItem} ${isActive ? styles.active : ''}`}
        >
          <LayoutDashboard size={20} />
          <span className={styles.bottomNavLabel}>Home</span>
        </NavLink>

        <NavLink
          to="/expenses"
          className={({ isActive }) => `${styles.bottomNavItem} ${isActive ? styles.active : ''}`}
        >
          <ReceiptText size={20} />
          <span className={styles.bottomNavLabel}>Expenses</span>
        </NavLink>

        {/* Center Empty Spacer for Floating Action Button */}
        <div className={styles.bottomNavSpacer} />

        <NavLink
          to="/reports"
          className={({ isActive }) => `${styles.bottomNavItem} ${isActive ? styles.active : ''}`}
        >
          <BarChart2 size={20} />
          <span className={styles.bottomNavLabel}>Reports</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) => `${styles.bottomNavItem} ${isActive ? styles.active : ''}`}
        >
          <Settings size={20} />
          <span className={styles.bottomNavLabel}>Settings</span>
        </NavLink>
      </nav>

      {/* Modals */}
      <QuickAddExpense isOpen={isQuickAddOpen} onClose={() => setIsQuickAddOpen(false)} />
      <AddIncomeModal isOpen={isAddIncomeOpen} onClose={() => setIsAddIncomeOpen(false)} />
      <ReviewCapturedModal isOpen={isReviewModalOpen} onClose={() => setIsReviewModalOpen(false)} />
    </div>
  );
};

export default Layout;

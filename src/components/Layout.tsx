import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ReceiptText, CalendarClock, Target, Settings, Plus, TrendingUp, BarChart2, X } from 'lucide-react';
import QuickAddExpense from './QuickAddExpense';
import AddIncomeModal from './AddIncomeModal';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isQuickAddOpen, setIsQuickAddOpen] = React.useState(false);
  const [isAddIncomeOpen, setIsAddIncomeOpen] = React.useState(false);
  const [isFabMenuOpen, setIsFabMenuOpen] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    const handleOpen = () => setIsQuickAddOpen(true);
    window.addEventListener('openAddExpense', handleOpen);
    return () => window.removeEventListener('openAddExpense', handleOpen);
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
      {/* Sidebar for Desktop */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>💰</span>
          <h2>Expense Tracker</h2>
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
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        <div className={styles.pageContainer}>
          {children}
        </div>
      </main>

      {/* FAB — context-aware */}
      {location.pathname !== '/settings' && (
        <div className={styles.fabWrapper}>
          {/* Popover menu for expense/income choice */}
          {isFabMenuOpen && isExpenseIncomeRoute && (
            <>
              {/* Backdrop to close menu */}
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
                  <span className={styles.fabMenuItemIcon} style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
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
                  <span className={styles.fabMenuItemIcon} style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent-primary)' }}>
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
            aria-label={isFabMenuOpen ? 'Close menu' : 'Add'}
            aria-expanded={isFabMenuOpen}
          >
            {isFabMenuOpen ? <X size={28} /> : <Plus size={28} />}
          </button>
        </div>
      )}

      {/* Bottom Navigation for Mobile */}
      <nav className={styles.bottomNav}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `${styles.bottomNavItem} ${isActive ? styles.active : ''}`}
          >
            <item.icon size={24} />
            <span className={styles.bottomNavLabel}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <QuickAddExpense isOpen={isQuickAddOpen} onClose={() => setIsQuickAddOpen(false)} />
      <AddIncomeModal isOpen={isAddIncomeOpen} onClose={() => setIsAddIncomeOpen(false)} />
    </div>
  );
};

export default Layout;

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ReceiptText, CalendarClock, Target, Settings, Plus } from 'lucide-react';
import QuickAddExpense from './QuickAddExpense';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isQuickAddOpen, setIsQuickAddOpen] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    const handleOpen = () => setIsQuickAddOpen(true);
    window.addEventListener('openAddExpense', handleOpen);
    return () => window.removeEventListener('openAddExpense', handleOpen);
  }, []);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/expenses', label: 'Expenses', icon: ReceiptText },
    { path: '/bills', label: 'Bills', icon: CalendarClock },
    { path: '/goals', label: 'Goals', icon: Target },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const handleQuickAdd = () => {
    setIsQuickAddOpen(true);
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

      {/* Quick Add Button (Floating) - Context Aware */}
      {location.pathname !== '/settings' && (
        <button 
          className={styles.fab} 
          onClick={() => {
            if (location.pathname === '/bills') {
              window.dispatchEvent(new Event('openAddBill'));
            } else if (location.pathname === '/goals') {
              window.dispatchEvent(new Event('openAddGoal'));
            } else {
              setIsQuickAddOpen(true);
            }
          }} 
          aria-label="Add"
        >
          <Plus size={28} />
        </button>
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
    </div>
  );
};

export default Layout;

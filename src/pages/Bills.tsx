import React, { useState } from 'react';
import { formatCurrency, formatCompactCurrency } from '../utils/format';
import { CheckCircle2, Circle, Calendar, Plus, Trash2, Edit2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/ui/Modal';
import BillForm from '../components/BillForm';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import { useBills } from '../hooks/useBills';
import { useCategories } from '../hooks/useCategories';
import { useSettings } from '../hooks/useSettings';
import { useHydration } from '../hooks/useHydration';
import type { Bill } from '../types';
import styles from './Bills.module.css';

const Bills: React.FC = () => {
  const { bills, totalBillsAmount, unpaidCount, updateBill, deleteBill } = useBills();
  const { categories } = useCategories();
  const { settings } = useSettings();
  const hydrated = useHydration();
  const isLoading = !hydrated;

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [deleteBillId, setDeleteBillId] = useState<string | null>(null);

  const togglePaid = (id: string) => {
    const bill = bills.find(b => b.id === id);
    if (bill) {
      updateBill(id, { isPaid: !bill.isPaid });
    }
  };

  const handleEditBill = (bill: Bill) => {
    setEditingBillId(bill.id);
    setShowAddForm(true);
  };

  if (isLoading) {
    return (
      <div className={styles.billsContainer}>
        <header className={styles.header}>
          <Skeleton variant="line" width={160} height={32} />
        </header>
        <div className={styles.statsGrid}>
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
        <div className={styles.billsList}>
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.billsContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Bills & Subscriptions</h1>
          <p className={styles.subtitle}>Track your recurring payments</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => { setEditingBillId(null); setShowAddForm(true); }}>
          Add Bill
        </Button>
      </header>

      <div className={styles.statsGrid}>
        <Card variant="elevated">
          <span className={styles.statLabel}>Total Monthly Bills</span>
          <h2 className={styles.statValue}>{formatCompactCurrency(totalBillsAmount, settings.currency)}</h2>
        </Card>
        <Card variant="elevated">
          <span className={styles.statLabel}>Unpaid This Month</span>
          <h2 className={`${styles.statValue} ${styles.unpaid}`}>{unpaidCount}</h2>
        </Card>
      </div>

      <div className={styles.billsList}>
        {bills.length > 0 ? (
          bills.map(bill => {
            const cat = categories.find(c => c.id === bill.categoryId);
            
            const dueDate = new Date(bill.dueDate);
            const now = new Date();
            const diffTime = dueDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let statusObj = { color: 'var(--text-secondary)', text: 'Upcoming' };
            if (bill.isPaid) {
              statusObj = { color: 'var(--color-success)', text: '🟢 Paid' };
            } else if (diffDays < 0) {
              statusObj = { color: 'var(--color-danger)', text: '🔴 Overdue' };
            } else if (diffDays === 0) {
              statusObj = { color: 'var(--color-warning)', text: '🟠 Due Today' };
            } else if (diffDays <= 3) {
              statusObj = { color: 'var(--color-warning)', text: `🟠 Due in ${diffDays}d` };
            }
            
            return (
              <Card key={bill.id} variant="flat" className={`${styles.billCard} ${bill.isPaid ? styles.paidCard : ''}`}>
                <div className={styles.billMain}>
                  <button 
                    type="button" 
                    className={styles.checkBtn} 
                    onClick={() => togglePaid(bill.id)}
                    aria-label={bill.isPaid ? 'Mark as unpaid' : 'Mark as paid'}
                  >
                    {bill.isPaid ? (
                      <CheckCircle2 size={24} className={styles.checked} />
                    ) : (
                      <Circle size={24} className={styles.unchecked} />
                    )}
                  </button>
                  
                  <div className={styles.billDetails}>
                    <div className={styles.billTitleRow}>
                      <h3 className={styles.billName}>{bill.name}</h3>
                      {bill.isRecurring && (
                        <span className={styles.recurringBadge} title={`Auto-generates ${bill.recurringFrequency} expenses`}>
                          🔄 {bill.recurringFrequency === 'weekly' ? 'Weekly' : 'Monthly'}
                        </span>
                      )}
                    </div>
                    <div className={styles.billMeta}>
                      <span className={styles.billCat}>
                        {cat?.icon} {cat?.name}
                      </span>
                      <span className={styles.billDate} style={{ color: statusObj.color }}>
                        <Calendar size={14} style={{ marginRight: '4px' }} />
                        {dueDate.toLocaleDateString()} ({statusObj.text})
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className={styles.billActions}>
                  <span className={styles.billAmount}>
                    {formatCurrency(bill.amount, settings.currency)}
                  </span>
                  <div className={styles.actionButtons}>
                    <button 
                      type="button" 
                      onClick={() => handleEditBill(bill)}
                      className={styles.iconBtn}
                      aria-label="Edit bill"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setDeleteBillId(bill.id)}
                      className={`${styles.iconBtn} ${styles.deleteBtn}`}
                      aria-label="Delete bill"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <p>No bills added yet. Start by tracking subscription costs or regular utilities!</p>
          </div>
        )}
      </div>

      <Modal
        isOpen={showAddForm}
        onClose={() => { setShowAddForm(false); setEditingBillId(null); }}
        title={editingBillId ? 'Edit Bill' : 'New Bill'}
        variant="dialog"
        accentColor="primary"
      >
        <BillForm
          billId={editingBillId}
          onClose={() => { setShowAddForm(false); setEditingBillId(null); }}
        />
      </Modal>

      <ConfirmModal
        isOpen={!!deleteBillId}
        title="Delete Bill"
        message="Are you sure you want to delete this bill? This will stop future recurring expense generation."
        confirmText="Delete"
        onConfirm={() => {
          if (deleteBillId) {
            deleteBill(deleteBillId);
            setDeleteBillId(null);
          }
        }}
        onCancel={() => setDeleteBillId(null)}
      />
    </div>
  );
};

export default Bills;

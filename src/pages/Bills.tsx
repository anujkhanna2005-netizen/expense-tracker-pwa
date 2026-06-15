import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { formatCurrency, formatCompactCurrency } from '../utils/format';
import { CheckCircle2, Circle, Calendar, Plus, X, Trash2, Edit2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import styles from './Bills.module.css';

const Bills: React.FC = () => {
  const { bills, settings, categories, addBill, updateBill, deleteBill } = useData();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [deleteBillId, setDeleteBillId] = useState<string | null>(null);
  
  const [newBillName, setNewBillName] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newBillDue, setNewBillDue] = useState('');
  const [newBillCat, setNewBillCat] = useState('');

  React.useEffect(() => {
    const handleOpen = () => setShowAddForm(true);
    window.addEventListener('openAddBill', handleOpen);
    return () => window.removeEventListener('openAddBill', handleOpen);
  }, []);

  const togglePaid = (id: string) => {
    const bill = bills.find(b => b.id === id);
    if (bill) {
      updateBill(id, { isPaid: !bill.isPaid });
    }
  };

  const handleEditBill = (bill: any) => {
    setEditingBillId(bill.id);
    setNewBillName(bill.name);
    setNewBillAmount(bill.amount.toString());
    setNewBillDue(bill.dueDate);
    setNewBillCat(bill.categoryId);
    setShowAddForm(true);
  };

  const handleAddBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBillName || !newBillAmount || !newBillDue || !newBillCat) return;
    
    if (editingBillId) {
      updateBill(editingBillId, {
        name: newBillName,
        amount: Number(newBillAmount),
        dueDate: newBillDue,
        categoryId: newBillCat
      });
      setEditingBillId(null);
    } else {
      addBill({
        name: newBillName,
        amount: Number(newBillAmount),
        dueDate: newBillDue,
        isPaid: false,
        reminderEnabled: false,
        categoryId: newBillCat
      });
    }
    
    setShowAddForm(false);
    setNewBillName('');
    setNewBillAmount('');
    setNewBillDue('');
    setNewBillCat('');
  };

  // Calculate stats for current month using local timezone
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthBills = bills.filter(b => b.dueDate.startsWith(currentMonthPrefix));
  
  const totalBillsAmount = currentMonthBills.reduce((sum, b) => sum + b.amount, 0);
  const unpaidCount = currentMonthBills.filter(b => !b.isPaid).length;

  return (
    <div className={styles.billsContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Bills & Subscriptions</h1>
          <p className={styles.subtitle}>Track your recurring payments</p>
        </div>
        {!showAddForm && (
          <button 
            className={styles.addBtn}
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={20} />
            <span>Add Bill</span>
          </button>
        )}
      </header>

      {showAddForm && (
        <form className={styles.addForm} onSubmit={handleAddBill}>
          <div className={styles.formHeader}>
            <h3>New Bill</h3>
            <button type="button" onClick={() => setShowAddForm(false)} className={styles.closeBtn}><X size={20} /></button>
          </div>
          <div className={styles.inputGroup}>
            <input type="text" placeholder="Bill Name" value={newBillName} onChange={(e) => setNewBillName(e.target.value)} className={styles.input} required />
            <input type="number" placeholder="Amount" value={newBillAmount} onChange={(e) => setNewBillAmount(e.target.value)} className={styles.input} required min="0.01" step="0.01" />
            <input type="date" value={newBillDue} onChange={(e) => setNewBillDue(e.target.value)} className={styles.input} required />
            <select value={newBillCat} onChange={(e) => setNewBillCat(e.target.value)} className={styles.input} required>
              <option value="">Select Category</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            <button type="submit" className={styles.submitBtn}>Save Bill</button>
          </div>
        </form>
      )}

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Monthly Bills</span>
          <h2 className={styles.statValue}>{formatCompactCurrency(totalBillsAmount, settings.currency)}</h2>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Unpaid This Month</span>
          <h2 className={`${styles.statValue} ${styles.unpaid}`}>{unpaidCount}</h2>
        </div>
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
              statusObj = { color: 'var(--success)', text: '🟢 Paid' };
            } else if (diffDays < 0) {
              statusObj = { color: 'var(--danger)', text: '🔴 Overdue' };
            } else if (diffDays <= 3) {
              statusObj = { color: 'var(--warning)', text: '🟡 Due soon' };
            } else {
              statusObj = { color: 'var(--text-secondary)', text: '⚪ Upcoming' };
            }

            return (
              <div key={bill.id} className={`${styles.billCard} ${bill.isPaid ? styles.paid : ''}`}>
                <button 
                  className={styles.checkBtn} 
                  aria-label={bill.isPaid ? "Mark unpaid" : "Mark paid"}
                  onClick={() => togglePaid(bill.id)}
                >
                  {bill.isPaid ? <CheckCircle2 size={28} className={styles.checkedIcon} /> : <Circle size={28} className={styles.uncheckedIcon} />}
                </button>
                
                <div className={styles.billDetails}>
                  <h3 className={styles.billName}>{bill.name}</h3>
                  <div className={styles.billMeta}>
                    <span className={styles.billCat}>{cat?.name || 'Bill'}</span>
                  </div>
                </div>

                <div className={styles.billSchedule}>
                  <div className={styles.scheduleItem}>
                    <Calendar size={14} />
                    <span>Due: {bill.dueDate}</span>
                  </div>
                  <div className={styles.scheduleItem} style={{ color: statusObj.color, fontWeight: 500 }}>
                    {statusObj.text}
                  </div>
                </div>

                <div className={styles.billAmount}>
                  {formatCurrency(bill.amount, settings.currency)}
                </div>

                <div className={styles.actionBtns}>
                  <button onClick={() => handleEditBill(bill)} className={styles.iconBtn} aria-label="Edit"><Edit2 size={16} /></button>
                  <button onClick={() => setDeleteBillId(bill.id)} className={styles.iconBtn} aria-label="Delete"><Trash2 size={16} /></button>
                </div>
              </div>
            )
          })
        ) : (
          <div className={styles.emptyState}>
            <Calendar size={48} className={styles.emptyIcon} />
            <h3>No bills added yet.</h3>
            <p>Add your first recurring payment.</p>
            <button className={styles.emptyStateBtn} onClick={() => setShowAddForm(true)}>Add Bill</button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteBillId}
        title="Delete Bill"
        message="Are you sure you want to delete this bill?"
        confirmText="Delete Bill"
        onConfirm={() => {
          if (deleteBillId) deleteBill(deleteBillId);
        }}
        onCancel={() => setDeleteBillId(null)}
      />
    </div>
  );
};

export default Bills;

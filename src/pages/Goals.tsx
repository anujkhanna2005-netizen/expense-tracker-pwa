import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { formatCurrency, formatCompactCurrency } from '../utils/format';
import { Plus, Target, Trophy, X, Trash2, Edit2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import AddFundsModal from '../components/AddFundsModal';
import styles from './Goals.module.css';

const Goals: React.FC = () => {
  const { goals, settings, addGoal, updateGoal, deleteGoal } = useData();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');

  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);
  const [fundGoal, setFundGoal] = useState<any>(null);

  React.useEffect(() => {
    const handleOpen = () => setShowAddForm(true);
    window.addEventListener('openAddGoal', handleOpen);
    return () => window.removeEventListener('openAddGoal', handleOpen);
  }, []);

  const handleEditGoal = (goal: any) => {
    setEditingGoalId(goal.id);
    setNewGoalName(goal.name);
    setNewGoalTarget(goal.targetAmount.toString());
    setShowAddForm(true);
  };

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName || !newGoalTarget) return;
    
    if (editingGoalId) {
      updateGoal(editingGoalId, {
        name: newGoalName,
        targetAmount: Number(newGoalTarget)
      });
      setEditingGoalId(null);
    } else {
      addGoal({
        name: newGoalName,
        targetAmount: Number(newGoalTarget),
        currentAmount: 0
      });
    }
    
    setShowAddForm(false);
    setNewGoalName('');
    setNewGoalTarget('');
  };

  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);

  return (
    <div className={styles.goalsContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Savings Goals</h1>
          <p className={styles.subtitle}>Track your big purchases</p>
        </div>
        {!showAddForm && (
          <button 
            className={styles.addBtn}
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={20} />
            <span>Add Goal</span>
          </button>
        )}
      </header>

      {showAddForm && (
        <form className={styles.addForm} onSubmit={handleAddGoal}>
          <div className={styles.formHeader}>
            <h3>New Goal</h3>
            <button type="button" onClick={() => setShowAddForm(false)} className={styles.closeBtn}><X size={20} /></button>
          </div>
          <div className={styles.inputGroup}>
            <input 
              type="text" 
              placeholder="Goal Name (e.g. New Laptop)" 
              value={newGoalName} 
              onChange={e => setNewGoalName(e.target.value)} 
              required 
              className={styles.input}
            />
            <input 
              type="number" 
              placeholder="Target Amount" 
              value={newGoalTarget} 
              onChange={e => setNewGoalTarget(e.target.value)} 
              required 
              min="1"
              step="0.01"
              className={styles.input}
            />
            <button type="submit" className={styles.submitBtn}>Save Goal</button>
          </div>
        </form>
      )}

      <div className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <Trophy className={styles.trophyIcon} size={24} />
          <h3>Total Savings Progress</h3>
        </div>
        <div className={styles.summaryStats}>
          <div className={styles.statGroup}>
            <span className={styles.statLabel}>Saved so far</span>
            <span className={styles.statAmount}>{formatCompactCurrency(totalSaved, settings.currency)}</span>
          </div>
          <div className={styles.statGroup}>
            <span className={styles.statLabel}>Total Goal</span>
            <span className={styles.statAmount}>{formatCompactCurrency(totalTarget, settings.currency)}</span>
          </div>
        </div>
      </div>

      <div className={styles.goalsList}>
        {goals.length > 0 ? (
          goals.map(goal => {
            const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
            const isCompleted = progress >= 100;
            
            return (
              <div key={goal.id} className={styles.goalCard}>
                <div className={styles.goalHeader}>
                  <div className={styles.goalTitleGroup}>
                    <Target size={20} className={isCompleted ? styles.completedIcon : styles.targetIcon} />
                    <h3 className={styles.goalName}>{goal.name}</h3>
                  </div>
                  <div className={styles.goalAmounts}>
                    <span className={styles.currentAmount}>{formatCurrency(goal.currentAmount, settings.currency)}</span>
                    <span className={styles.targetAmount}>/ {formatCurrency(goal.targetAmount, settings.currency)}</span>
                  </div>
                </div>
                
                <div className={styles.progressContainer}>
                  <div className={styles.progressBar}>
                    <div 
                      className={`${styles.progressFill} ${isCompleted ? styles.progressCompleted : ''}`} 
                      style={{ width: `${progress}%` }} 
                    />
                  </div>
                  <span className={styles.progressText}>{progress.toFixed(1)}%</span>
                </div>
                
                <div className={styles.goalActions}>
                  <button 
                    className={styles.fundBtn} 
                    disabled={isCompleted}
                    onClick={() => setFundGoal(goal)}
                  >
                    Add Funds
                  </button>
                  <div className={styles.actionBtns}>
                    <button onClick={() => handleEditGoal(goal)} className={styles.iconBtn} aria-label="Edit"><Edit2 size={16} /></button>
                    <button onClick={() => setDeleteGoalId(goal.id)} className={styles.iconBtn} aria-label="Delete"><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className={styles.emptyState}>
            <Target size={48} className={styles.emptyIcon} />
            <h3>No savings goals yet</h3>
            <p>Create a goal and start saving toward something important.</p>
            <button className={styles.emptyStateBtn} onClick={() => setShowAddForm(true)}>Add Goal</button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteGoalId}
        title="Delete Goal"
        message="Are you sure you want to delete this goal? All progress will be removed."
        confirmText="Delete Goal"
        onConfirm={() => {
          if (deleteGoalId) deleteGoal(deleteGoalId);
        }}
        onCancel={() => setDeleteGoalId(null)}
      />

      <AddFundsModal
        isOpen={!!fundGoal}
        goal={fundGoal}
        onConfirm={(amount) => {
          if (fundGoal) updateGoal(fundGoal.id, { currentAmount: fundGoal.currentAmount + amount });
        }}
        onCancel={() => setFundGoal(null)}
      />
    </div>
  );
};

export default Goals;

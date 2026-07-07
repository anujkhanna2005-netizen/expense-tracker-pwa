import React, { useState } from 'react';
import { formatCurrency, formatCompactCurrency } from '../utils/format';
import { Trophy, Target, Plus, Trash2, Edit2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/ui/Modal';
import GoalForm from '../components/GoalForm';
import AddFundsModal from '../components/AddFundsModal';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import ProgressBar from '../components/ui/ProgressBar';
import { useGoals } from '../hooks/useGoals';
import { useSettings } from '../hooks/useSettings';
import { useHydration } from '../hooks/useHydration';
import type { Goal } from '../types';
import styles from './Goals.module.css';

const Goals: React.FC = () => {
  const { goals, totalSaved, totalTarget, deleteGoal } = useGoals();
  const { settings } = useSettings();
  const hydrated = useHydration();
  const isLoading = !hydrated;

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);
  const [fundGoal, setFundGoal] = useState<Goal | null>(null);

  const handleEditGoal = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setShowAddForm(true);
  };

  if (isLoading) {
    return (
      <div className={styles.goalsContainer}>
        <header className={styles.header}>
          <Skeleton variant="line" width={160} height={32} />
        </header>
        <Skeleton variant="card" height={100} />
        <div className={styles.goalsList}>
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.goalsContainer}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Savings Goals</h1>
          <p className={styles.subtitle}>Track your big purchases</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => { setEditingGoalId(null); setShowAddForm(true); }}>
          Add Goal
        </Button>
      </header>

      <Card variant="elevated" className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <Trophy className={styles.trophyIcon} size={24} aria-hidden="true" />
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
        {totalTarget > 0 && (
          <ProgressBar value={totalSaved} max={totalTarget} size="lg" style={{ marginTop: '12px' }} />
        )}
      </Card>

      <div className={styles.goalsList}>
        {goals.length > 0 ? (
          goals.map(goal => {
            const progress = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
            const isCompleted = progress >= 100;
            
            return (
              <Card key={goal.id} variant="flat" className={styles.goalCard}>
                <div className={styles.goalHeader}>
                  <div className={styles.goalTitleGroup}>
                    <Target size={20} className={isCompleted ? styles.completedIcon : styles.targetIcon} aria-hidden="true" />
                    <h3 className={styles.goalName}>{goal.name}</h3>
                  </div>
                  <div className={styles.goalAmounts}>
                    <span className={styles.currentAmount}>{formatCurrency(goal.currentAmount, settings.currency)}</span>
                    <span className={styles.targetAmount}>/ {formatCurrency(goal.targetAmount, settings.currency)}</span>
                  </div>
                </div>
                
                <div className={styles.progressContainer}>
                  <ProgressBar value={goal.currentAmount} max={goal.targetAmount} size="sm" />
                  <span className={styles.progressText}>{progress.toFixed(1)}%</span>
                </div>
                
                <div className={styles.goalActions}>
                  <Button 
                    variant="secondary"
                    size="sm"
                    disabled={isCompleted}
                    onClick={() => setFundGoal(goal)}
                  >
                    Add Funds
                  </Button>
                  <div className={styles.actionBtns}>
                    <button onClick={() => handleEditGoal(goal)} className={styles.iconBtn} aria-label="Edit goal"><Edit2 size={16} /></button>
                    <button onClick={() => setDeleteGoalId(goal.id)} className={styles.iconBtn} aria-label="Delete goal"><Trash2 size={16} /></button>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <Target size={48} className={styles.emptyIcon} aria-hidden="true" />
            <h3>No savings goals yet</h3>
            <p>Create a goal and start saving toward something important.</p>
            <Button variant="primary" onClick={() => { setEditingGoalId(null); setShowAddForm(true); }}>Add Goal</Button>
          </div>
        )}
      </div>

      <Modal
        isOpen={showAddForm}
        onClose={() => { setShowAddForm(false); setEditingGoalId(null); }}
        title={editingGoalId ? 'Edit Goal' : 'New Goal'}
        variant="dialog"
        accentColor="primary"
      >
        <GoalForm
          goalId={editingGoalId}
          onClose={() => { setShowAddForm(false); setEditingGoalId(null); }}
        />
      </Modal>

      <AddFundsModal
        isOpen={!!fundGoal}
        goal={fundGoal}
        onConfirm={(amount) => {
          if (fundGoal) {
            const { updateGoal } = useGoals();
            updateGoal(fundGoal.id, { currentAmount: fundGoal.currentAmount + amount });
            setFundGoal(null);
          }
        }}
        onCancel={() => setFundGoal(null)}
      />

      <ConfirmModal
        isOpen={!!deleteGoalId}
        title="Delete Goal"
        message="Are you sure you want to delete this goal? All progress will be removed."
        confirmText="Delete"
        onConfirm={() => {
          if (deleteGoalId) {
            deleteGoal(deleteGoalId);
            setDeleteGoalId(null);
          }
        }}
        onCancel={() => setDeleteGoalId(null)}
      />
    </div>
  );
};

export default Goals;

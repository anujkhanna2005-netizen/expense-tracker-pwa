import React, { useState, useEffect } from 'react';
import { useGoals } from '../hooks/useGoals';
import Button from './ui/Button';
import styles from './QuickAddExpense.module.css';

interface GoalFormProps {
  goalId: string | null;
  onClose: () => void;
}

export const GoalForm: React.FC<GoalFormProps> = ({ goalId, onClose }) => {
  const { goals, addGoal, updateGoal } = useGoals();

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');

  useEffect(() => {
    if (goalId) {
      const goal = goals.find(g => g.id === goalId);
      if (goal) {
        setName(goal.name);
        setTargetAmount(goal.targetAmount.toString());
      }
    } else {
      setName('');
      setTargetAmount('');
    }
  }, [goalId, goals]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetAmount) return;

    if (goalId) {
      updateGoal(goalId, {
        name,
        targetAmount: Number(targetAmount)
      });
    } else {
      addGoal({
        name,
        targetAmount: Number(targetAmount),
        currentAmount: 0
      });
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} style={{ padding: 0 }}>
      <div className={styles.field}>
        <label htmlFor="goal-name">Goal Name</label>
        <input 
          id="goal-name"
          type="text" 
          placeholder="e.g. New Laptop, Vacation..." 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          className={styles.input} 
          required 
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="goal-target">Target Amount</label>
        <input 
          id="goal-target"
          type="number" 
          placeholder="0.00" 
          value={targetAmount} 
          onChange={(e) => setTargetAmount(e.target.value)} 
          className={styles.input} 
          required 
          min="1" 
          step="0.01" 
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          Save Goal
        </Button>
      </div>
    </form>
  );
};

export default GoalForm;

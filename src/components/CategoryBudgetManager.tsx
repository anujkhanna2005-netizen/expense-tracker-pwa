import React from 'react';
import { useCategories } from '../hooks/useCategories';
import { useSettings } from '../hooks/useSettings';
import Input from './ui/Input';
import styles from './CategoryBudgetManager.module.css';

const CategoryBudgetManager: React.FC = () => {
  const { categories } = useCategories();
  const { settings, updateSettings } = useSettings();
  const budgets = settings.categoryBudgets || {};

  const handleBudgetChange = (categoryId: string, val: string) => {
    const amount = val === '' ? 0 : Number(val);
    const updatedBudgets = { ...budgets };
    if (amount <= 0) {
      delete updatedBudgets[categoryId];
    } else {
      updatedBudgets[categoryId] = amount;
    }
    updateSettings({ categoryBudgets: updatedBudgets });
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Category Budgets</h3>
      <p className={styles.desc}>Set monthly limits for specific categories (leave blank for no limit)</p>
      
      <div className={styles.list}>
        {categories.map((cat) => (
          <div key={cat.id} className={styles.row}>
            <div className={styles.categoryInfo}>
              <span className={styles.icon}>{cat.icon || '📦'}</span>
              <span className={styles.name}>{cat.name}</span>
            </div>
            <div className={styles.inputWrapper}>
              <span className={styles.currency}>{settings.currency}</span>
              <Input
                type="number"
                placeholder="No limit"
                value={budgets[cat.id] || ''}
                onChange={(val) => handleBudgetChange(cat.id, val)}
                className={styles.input}
                min="0"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoryBudgetManager;

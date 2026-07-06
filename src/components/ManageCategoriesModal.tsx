import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import ConfirmModal from './ConfirmModal';
import styles from './ManageCategoriesModal.module.css';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({ isOpen, onClose }) => {
  const { categories, addCategory, deleteCategory, expenses } = useData();
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📦');
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    
    addCategory({
      name: newCatName.trim(),
      icon: newCatIcon,
      isDefault: false
    });
    setNewCatName('');
    setNewCatIcon('📦');
  };

  const handleDelete = (id: string) => {
    // Check if category is used
    const isUsed = expenses.some(exp => exp.categoryId === id);
    if (isUsed) {
      // TODO: replace with toast in Phase 2
      alert('Cannot delete this category because it is used by existing expenses.');
      return;
    }
    
    setDeleteCatId(id);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Manage Categories</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className={styles.content}>
          <form className={styles.addForm} onSubmit={handleAdd}>
            <div className={styles.inputGroup}>
              <input 
                type="text" 
                className={styles.iconInput} 
                value={newCatIcon} 
                onChange={(e) => setNewCatIcon(e.target.value)} 
                maxLength={2}
                title="Emoji Icon"
              />
              <input 
                type="text" 
                className={styles.nameInput} 
                value={newCatName} 
                onChange={(e) => setNewCatName(e.target.value)} 
                placeholder="New category name..." 
                required
              />
              <button type="submit" className={styles.addBtn} disabled={!newCatName.trim()}>
                <Plus size={20} />
              </button>
            </div>
          </form>

          <div className={styles.catList}>
            {categories.map(cat => (
              <div key={cat.id} className={styles.catItem}>
                <div className={styles.catInfo}>
                  <span className={styles.catIcon}>{cat.icon}</span>
                  <span className={styles.catName}>{cat.name}</span>
                </div>
                {!cat.isDefault && (
                  <button 
                    className={styles.deleteBtn} 
                    onClick={() => handleDelete(cat.id)}
                    title="Delete category"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteCatId}
        title="Delete Category"
        message="Are you sure you want to delete this category?"
        confirmText="Delete"
        onConfirm={() => {
          if (deleteCatId) {
            deleteCategory(deleteCatId);
            setDeleteCatId(null);
          }
        }}
        onCancel={() => setDeleteCatId(null)}
      />
    </div>
  );
};

export default ManageCategoriesModal;

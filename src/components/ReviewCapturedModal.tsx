import React, { useState } from 'react';
import { useCapturedStore } from '../stores/capturedTransactionStore';
import { useCategoryStore } from '../stores/categoryStore';
import { maskSensitiveDetails } from '../services/transactionClassifier';
import Select from './ui/Select';
import styles from './ReviewCapturedModal.module.css';

interface ReviewCapturedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReviewCapturedModal: React.FC<ReviewCapturedModalProps> = ({ isOpen, onClose }) => {
  const pendingItems = useCapturedStore((state) => state.pendingItems);
  const updateCapturedItem = useCapturedStore((state) => state.updateCapturedItem);
  const approveItem = useCapturedStore((state) => state.approveItem);
  const dismissItem = useCapturedStore((state) => state.dismissItem);
  const approveAllHighConfidence = useCapturedStore((state) => state.approveAllHighConfidence);
  const dismissAll = useCapturedStore((state) => state.dismissAll);

  const categories = useCategoryStore((state) => state.categories);

  const [expandedSnippets, setExpandedSnippets] = useState<Record<string, boolean>>({});
  const [rememberMap, setRememberMap] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const toggleSnippet = (id: string) => {
    setExpandedSnippets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRememberToggle = (id: string, checked: boolean) => {
    setRememberMap((prev) => ({ ...prev, [id]: checked }));
  };

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: `${c.icon || '📦'} ${c.name}`,
  }));

  const highConfidenceCount = pendingItems.filter((i) => i.confidence === 'high' && !i.isPossibleDuplicate).length;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <div className={styles.title}>
              Review Captured Transactions
              {pendingItems.length > 0 && <span className={styles.badge}>{pendingItems.length}</span>}
            </div>
            <div className={styles.subtitle}>
              Verify details, customize categories, and save directly to your records.
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close review dialog">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {pendingItems.length === 0 ? (
            <div className={styles.emptyState}>
              <span style={{ fontSize: 32 }}>✨</span>
              <strong>All caught up!</strong>
              <span>No captured transactions waiting for review.</span>
            </div>
          ) : (
            pendingItems.map((item) => {
              const isRemembered = rememberMap[item.id] !== false; // default to true
              const isSnippetExpanded = Boolean(expandedSnippets[item.id]);

              return (
                <div key={item.id} className={styles.itemCard}>
                  {item.isPossibleDuplicate && (
                    <div
                      style={{
                        background: 'rgba(234, 179, 8, 0.12)',
                        color: '#b45309',
                        border: '1px solid rgba(234, 179, 8, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        padding: '6px 10px',
                        fontSize: 12,
                        fontWeight: 500,
                        marginBottom: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>⚠️</span>
                      <span>
                        Possible duplicate of {item.possibleDuplicateOf || 'another'} alert. Confirm if this was a separate payment.
                      </span>
                    </div>
                  )}

                  <div className={styles.itemTop}>
                    <div className={styles.metaLeft}>
                      <span className={styles.appBadge}>{item.sourceAppName}</span>
                      {item.combinedSources && item.combinedSources.length > 1 && (
                        <span style={{ fontSize: 11, background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>
                          Merged sources: {item.combinedSources.join(' + ')}
                        </span>
                      )}
                      {item.isTransfer && (
                        <span style={{ fontSize: 11, background: 'rgba(59, 130, 246, 0.15)', color: '#2563eb', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                          ↔️ Internal Transfer
                        </span>
                      )}
                      {item.isReversal && (
                        <span style={{ fontSize: 11, background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                          ↩️ Reversal
                        </span>
                      )}
                      {item.isRefund && !item.isReversal && (
                        <span style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                          🔄 Refund
                        </span>
                      )}
                      <span className={styles.timeText}>
                        {item.date} • {item.time}
                      </span>
                    </div>
                    {item.confidence === 'high' && !item.isPossibleDuplicate ? (
                      <span className={styles.confidenceHigh}>✓ High confidence</span>
                    ) : (
                      <span className={styles.confidenceReview}>
                        ⚠️ {item.confidenceReason || 'Needs review'}
                      </span>
                    )}
                  </div>

                  <div className={styles.formGrid}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Amount (₹)</label>
                      <input
                        type="number"
                        className={styles.input}
                        value={item.amount || ''}
                        onChange={(e) => updateCapturedItem(item.id, { amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Direction</label>
                      <div className={styles.dirToggle}>
                        <button
                          type="button"
                          className={`${styles.dirBtn} ${
                            item.direction === 'expense' ? styles.dirActiveExpense : ''
                          }`}
                          onClick={() => updateCapturedItem(item.id, { direction: 'expense', isTransfer: false })}
                        >
                          Expense
                        </button>
                        <button
                          type="button"
                          className={`${styles.dirBtn} ${
                            item.direction === 'income' ? styles.dirActiveIncome : ''
                          }`}
                          onClick={() => updateCapturedItem(item.id, { direction: 'income', isTransfer: false })}
                        >
                          Income
                        </button>
                        <button
                          type="button"
                          className={`${styles.dirBtn} ${
                            item.direction === 'transfer' ? styles.dirActiveIncome : ''
                          }`}
                          onClick={() => updateCapturedItem(item.id, { direction: 'transfer', isTransfer: true })}
                        >
                          Transfer
                        </button>
                      </div>
                    </div>

                    <div className={styles.fieldGroupFull}>
                      <label className={styles.label}>Payee / Merchant</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={item.payee}
                        onChange={(e) => updateCapturedItem(item.id, { payee: e.target.value })}
                        placeholder="e.g. Swiggy, Starbucks, Manish"
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Date</label>
                      <input
                        type="date"
                        className={styles.input}
                        value={item.date}
                        onChange={(e) => updateCapturedItem(item.id, { date: e.target.value })}
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.label}>Category</label>
                      <Select
                        options={categoryOptions}
                        value={item.categoryId}
                        onChange={(val) => updateCapturedItem(item.id, { categoryId: val })}
                      />
                    </div>
                  </div>

                  {item.payee && (
                    <label className={styles.rememberRow}>
                      <input
                        type="checkbox"
                        checked={isRemembered}
                        onChange={(e) => handleRememberToggle(item.id, e.target.checked)}
                      />
                      <span>Remember category for &ldquo;{item.payee}&rdquo;</span>
                    </label>
                  )}

                  <div>
                    <button
                      type="button"
                      className={styles.snippetToggle}
                      onClick={() => toggleSnippet(item.id)}
                    >
                      {isSnippetExpanded ? '▾ Hide original notification' : '▸ View original notification'}
                    </button>
                    {isSnippetExpanded && (
                      <div className={styles.snippet} style={{ marginTop: 6 }}>
                        <strong>{maskSensitiveDetails(item.title)}</strong>
                        <div>{maskSensitiveDetails(item.rawText)}</div>
                        {item.upiRef && <div style={{ marginTop: 4 }}>UPI Ref: {item.upiRef}</div>}
                      </div>
                    )}
                  </div>

                  <div className={styles.itemFooter}>
                    <button
                      type="button"
                      className={styles.dismissBtn}
                      onClick={() => dismissItem(item.id)}
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      className={styles.saveBtn}
                      onClick={() => approveItem(item.id, isRemembered)}
                    >
                      Save as {item.isTransfer || item.direction === 'transfer' ? 'Transfer' : item.isReversal ? 'Reversal' : item.direction === 'income' ? 'Income' : 'Expense'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {pendingItems.length > 0 && (
          <div className={styles.footer}>
            <button type="button" className={styles.dismissAllBtn} onClick={dismissAll}>
              Dismiss All
            </button>
            <div className={styles.batchActions}>
              {highConfidenceCount > 0 && (
                <button
                  type="button"
                  className={styles.approveAllBtn}
                  onClick={() => approveAllHighConfidence()}
                >
                  Approve High Confidence ({highConfidenceCount})
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

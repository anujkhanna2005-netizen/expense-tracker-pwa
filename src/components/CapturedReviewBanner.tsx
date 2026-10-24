import React, { useState } from 'react';
import { useCapturedStore } from '../stores/capturedTransactionStore';
import { ReviewCapturedModal } from './ReviewCapturedModal';
import { Zap, ArrowRight } from 'lucide-react';
import styles from './CapturedReviewBanner.module.css';

export const CapturedReviewBanner: React.FC = () => {
  const pendingItems = useCapturedStore((state) => state.pendingItems);
  const dismissAll = useCapturedStore((state) => state.dismissAll);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (pendingItems.length === 0) return null;

  const sources = Array.from(new Set(pendingItems.map((i) => i.sourceAppName || 'UPI App'))).slice(0, 3).join(', ');

  return (
    <>
      <section className={styles.banner}>
        <div className={styles.accentStripe} />
        <div className={styles.content}>
          <div className={styles.iconWrap} aria-hidden="true">
            <Zap size={22} className={styles.boltIcon} fill="currentColor" />
          </div>
          <div className={styles.textGroup}>
            <div className={styles.headerRow}>
              <span className={styles.title}>
                {pendingItems.length === 1
                  ? '1 UPI alert needs review'
                  : `${pendingItems.length} UPI transactions need review`}
              </span>
              <span className={styles.newBadge}>New</span>
            </div>
            <p className={styles.subtitle}>
              Captured from {sources || 'incoming payment notifications'}. Confirm details to keep insights accurate.
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.reviewBtn}
                onClick={() => setIsModalOpen(true)}
              >
                <span>Review Now ({pendingItems.length})</span>
                <ArrowRight size={15} />
              </button>
              <button
                type="button"
                className={styles.dismissBtn}
                onClick={() => dismissAll()}
              >
                Dismiss All
              </button>
            </div>
          </div>
        </div>
      </section>
      <ReviewCapturedModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

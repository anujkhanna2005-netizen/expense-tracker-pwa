import type { Bill } from '../types';

/**
 * notificationService.ts
 *
 * Handles requesting local Notification permissions and scheduling local notifications
 * for upcoming bills.
 *
 * LIMITATION:
 * This is a local-only reminder service that runs in-app. Since there is no push server,
 * reminders can only fire while the app is active/open in the browser.
 */

export const notificationService = {
  /**
   * Request permission from the user for showing notifications.
   */
  requestPermission: async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported in this browser.');
      return 'denied';
    }
    return await Notification.requestPermission();
  },

  /**
   * Checks bills and triggers local browser notification if any are due within 3 days.
   * Ensures we don't spam notifications by recording last notified timestamps in localStorage.
   */
  checkAndNotifyDueBills: (bills: Bill[]): void => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    bills.forEach((bill) => {
      if (bill.isPaid) return;

      const dueDate = new Date(bill.dueDate);
      // Check if bill is due between now (or overdue) and 3 days from now
      if (dueDate <= threeDaysFromNow) {
        const lastNotifiedKey = `notified_bill_${bill.id}`;
        const lastNotified = localStorage.getItem(lastNotifiedKey);
        
        // Notify once per day per bill to prevent spam
        const todayStr = now.toISOString().split('T')[0];
        if (lastNotified === todayStr) return;

        const diffTime = dueDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let body = `${bill.name} is due on ${bill.dueDate}.`;
        if (diffDays < 0) {
          body = `${bill.name} is overdue! Due date was ${bill.dueDate}.`;
        } else if (diffDays === 0) {
          body = `${bill.name} is due today!`;
        } else {
          body = `${bill.name} is due in ${diffDays} day${diffDays > 1 ? 's' : ''} (${bill.dueDate}).`;
        }

        try {
          new Notification('Upcoming Bill Reminder 📅', {
            body,
            icon: '/icon-192.png',
          });
          localStorage.setItem(lastNotifiedKey, todayStr);
        } catch (err) {
          console.error('Failed to trigger notification:', err);
        }
      }
    });
  },
};

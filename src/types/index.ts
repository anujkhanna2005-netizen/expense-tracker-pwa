export const PAYMENT_METHODS = ['Cash', 'Credit Card', 'Debit Card', 'UPI', 'Bank Transfer'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export interface Category {
  id: string;
  name: string;
  icon?: string;
  isDefault?: boolean;
}

export interface Expense {
  id: string;
  amount: number;
  categoryId: string;
  date: string; // ISO string
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string; // 'YYYY-MM-DD' or day of month
  isPaid: boolean;
  reminderEnabled: boolean;
  categoryId: string;
  /** Whether this bill should auto-generate a matching expense each period */
  isRecurring?: boolean;
  /** Frequency for auto-generating expenses — required when isRecurring is true */
  recurringFrequency?: 'weekly' | 'monthly';
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  createdAt: string;
}

// App Settings
export interface Settings {
  darkMode: boolean;
  currency: string;
  monthlyBudgetLimit?: number;
  /** Per-category spending limits. Key = categoryId, value = limit amount. 0 or absent = no limit */
  categoryBudgets?: Record<string, number>;
}

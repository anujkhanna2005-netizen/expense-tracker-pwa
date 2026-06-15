export type PaymentMethod = 'Cash' | 'Credit Card' | 'Debit Card' | 'UPI' | 'Bank Transfer';

export interface Category {
  id: string;
  name: string;
  color?: string; // Hex color
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

export interface Budget {
  monthYear: string; // 'YYYY-MM'
  totalLimit: number;
  categoryLimits: Record<string, number>; // categoryId -> limit
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string; // 'YYYY-MM-DD' or day of month
  isPaid: boolean;
  reminderEnabled: boolean;
  categoryId: string;
}

export interface SplitParticipant {
  id: string;
  name: string;
  amountOwed: number;
  isSettled: boolean;
}

export interface Split {
  id: string;
  expenseId?: string; // Optional link to an expense
  description: string;
  totalAmount: number;
  paidBy: string; // Participant ID
  participants: SplitParticipant[];
  date: string;
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
}

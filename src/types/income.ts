export const INCOME_SOURCES = [
  'Salary',
  'Freelance',
  'Business',
  'Investment',
  'Gift',
  'Rental',
  'Bonus',
  'Other',
] as const;

export type IncomeSource = (typeof INCOME_SOURCES)[number];

export interface Income {
  id: string;
  amount: number;
  source: string; // one of INCOME_SOURCES or custom
  date: string; // ISO date
  notes?: string;
  isRecurring: boolean;
  recurringFrequency?: 'weekly' | 'monthly';
  createdAt: string;
  updatedAt: string;
}

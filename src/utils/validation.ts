import { z } from 'zod';
import { PAYMENT_METHODS } from '../types';

export const categorySchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Category name is required'),
  icon: z.string().optional(),
  isDefault: z.boolean().optional()
});

export const expenseSchema = z.object({
  id: z.string(),
  amount: z.number().positive('Amount must be greater than zero'),
  categoryId: z.string().min(1, 'Category is required'),
  date: z.string().min(1, 'Date is required'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const billSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Bill name is required'),
  amount: z.number().positive('Amount must be greater than zero'),
  dueDate: z.string().min(1, 'Due date is required'),
  isPaid: z.boolean(),
  reminderEnabled: z.boolean(),
  categoryId: z.string().min(1, 'Category is required'),
  // Recurring fields — optional for backward compatibility with existing persisted data
  isRecurring: z.boolean().optional(),
  recurringFrequency: z.enum(['weekly', 'monthly']).optional()
});

export const goalSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Goal name is required'),
  targetAmount: z.number().positive('Target amount must be greater than zero'),
  currentAmount: z.number().nonnegative('Current savings cannot be negative'),
  createdAt: z.string()
});

export const incomeSchema = z.object({
  id: z.string(),
  amount: z.number().positive('Amount must be greater than zero'),
  source: z.string().min(1, 'Source is required'),
  date: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
  isRecurring: z.boolean(),
  recurringFrequency: z.enum(['weekly', 'monthly']).optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const settingsSchema = z.object({
  darkMode: z.boolean(),
  currency: z.string().min(1),
  monthlyBudgetLimit: z.number().positive('Monthly budget limit must be positive').optional(),
  // Per-category budgets: Record<categoryId, limit> — optional, defaults to {} on first load
  categoryBudgets: z.record(z.string(), z.number().nonnegative()).optional()
});

export const importDataSchema = z.object({
  expenses: z.array(expenseSchema).optional(),
  categories: z.array(categorySchema).optional(),
  bills: z.array(billSchema).optional(),
  goals: z.array(goalSchema).optional(),
  incomes: z.array(incomeSchema).optional(),
  settings: settingsSchema.optional()
});
export default importDataSchema;

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
  categoryId: z.string().min(1, 'Category is required')
});

export const goalSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Goal name is required'),
  targetAmount: z.number().positive('Target amount must be greater than zero'),
  currentAmount: z.number().nonnegative('Current savings cannot be negative'),
  createdAt: z.string()
});

export const settingsSchema = z.object({
  darkMode: z.boolean(),
  currency: z.string().min(1),
  monthlyBudgetLimit: z.number().positive('Monthly budget limit must be positive').optional()
});

export const importDataSchema = z.object({
  expenses: z.array(expenseSchema).optional(),
  categories: z.array(categorySchema).optional(),
  bills: z.array(billSchema).optional(),
  goals: z.array(goalSchema).optional(),
  settings: settingsSchema.optional()
});
export default importDataSchema;

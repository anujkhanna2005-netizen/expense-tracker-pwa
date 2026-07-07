import type { ZodSchema } from 'zod';
import { useUiStore } from './uiStore';

export function createBaseActions<T extends { id: string; createdAt: string; updatedAt?: string }>(
  schema: ZodSchema<T>,
  errorMsgDefault: string
) {
  return {
    add: (items: T[], itemData: any): { success: boolean; newItem?: T; nextItems?: T[] } => {
      const newItem = {
        ...itemData,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any;

      const validation = schema.safeParse(newItem);
      if (!validation.success) {
        const errMsg = validation.error.issues[0]?.message || errorMsgDefault;
        useUiStore.getState().addToast(errMsg, 'error');
        return { success: false };
      }

      return { success: true, newItem, nextItems: [...items, newItem] };
    },

    update: (items: T[], id: string, updates: Partial<T>): { success: boolean; nextItem?: T; nextItems?: T[] } => {
      const index = items.findIndex((i) => i.id === id);
      if (index === -1) return { success: false };

      const nextItem = {
        ...items[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      const validation = schema.safeParse(nextItem);
      if (!validation.success) {
        const errMsg = validation.error.issues[0]?.message || errorMsgDefault;
        useUiStore.getState().addToast(errMsg, 'error');
        return { success: false };
      }

      const nextItems = items.map((i) => (i.id === id ? nextItem : i));
      return { success: true, nextItem, nextItems };
    },

    delete: (items: T[], id: string): T[] => {
      return items.filter((i) => i.id !== id);
    }
  };
}

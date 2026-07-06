import { useState, useEffect } from 'react';
import { useExpenseStore } from '../stores/expenseStore';
import { useCategoryStore } from '../stores/categoryStore';
import { useBillStore } from '../stores/billStore';
import { useGoalStore } from '../stores/goalStore';
import { useSettingsStore } from '../stores/settingsStore';

export function useHydration() {
  const [hydrated, setHydrated] = useState(
    useExpenseStore.persist.hasHydrated() &&
    useCategoryStore.persist.hasHydrated() &&
    useBillStore.persist.hasHydrated() &&
    useGoalStore.persist.hasHydrated() &&
    useSettingsStore.persist.hasHydrated()
  );

  useEffect(() => {
    if (hydrated) return;

    const check = () => {
      const isHydrated =
        useExpenseStore.persist.hasHydrated() &&
        useCategoryStore.persist.hasHydrated() &&
        useBillStore.persist.hasHydrated() &&
        useGoalStore.persist.hasHydrated() &&
        useSettingsStore.persist.hasHydrated();
      if (isHydrated) {
        setHydrated(true);
      }
    };

    const unsub1 = useExpenseStore.persist.onFinishHydration(check);
    const unsub2 = useCategoryStore.persist.onFinishHydration(check);
    const unsub3 = useBillStore.persist.onFinishHydration(check);
    const unsub4 = useGoalStore.persist.onFinishHydration(check);
    const unsub5 = useSettingsStore.persist.onFinishHydration(check);

    check();

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
    };
  }, [hydrated]);

  return hydrated;
}
export default useHydration;

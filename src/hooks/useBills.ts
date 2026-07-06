import { useBillStore } from '../stores/billStore';
import { useMemo } from 'react';

export function useBills() {
  const bills = useBillStore((state) => state.bills);
  const addBill = useBillStore((state) => state.addBill);
  const updateBill = useBillStore((state) => state.updateBill);
  const deleteBill = useBillStore((state) => state.deleteBill);

  const currentMonthBills = useMemo(() => {
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return bills.filter((b) => b.dueDate.startsWith(currentMonthPrefix));
  }, [bills]);

  const totalBillsAmount = useMemo(() => {
    return currentMonthBills.reduce((sum, b) => sum + b.amount, 0);
  }, [currentMonthBills]);

  const unpaidCount = useMemo(() => {
    return currentMonthBills.filter((b) => !b.isPaid).length;
  }, [currentMonthBills]);

  return {
    bills,
    currentMonthBills,
    totalBillsAmount,
    unpaidCount,
    addBill,
    updateBill,
    deleteBill
  };
}
export default useBills;

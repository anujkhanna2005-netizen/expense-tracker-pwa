import { useCategoryStore } from '../stores/categoryStore';

export function useCategories() {
  const categories = useCategoryStore((state) => state.categories);
  const addCategory = useCategoryStore((state) => state.addCategory);
  const updateCategory = useCategoryStore((state) => state.updateCategory);
  const deleteCategory = useCategoryStore((state) => state.deleteCategory);

  return {
    categories,
    addCategory,
    updateCategory,
    deleteCategory
  };
}
export default useCategories;

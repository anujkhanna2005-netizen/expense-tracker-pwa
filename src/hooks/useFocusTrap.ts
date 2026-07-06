import { useEffect } from 'react';
import type { RefObject } from 'react';

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;

    const element = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusableElementsString =
      'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]';
    
    const getFocusableNodes = () => {
      const nodes = Array.from(element.querySelectorAll<HTMLElement>(focusableElementsString));
      return nodes.filter(node => node.tabIndex >= 0);
    };

    const focusableNodes = getFocusableNodes();
    
    if (focusableNodes.length > 0) {
      focusableNodes[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const nodes = getFocusableNodes();
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }

      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      const activeElement = document.activeElement;

      if (e.shiftKey) {
        if (activeElement === firstNode) {
          lastNode.focus();
          e.preventDefault();
        }
      } else {
        if (activeElement === lastNode) {
          firstNode.focus();
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && previouslyFocused.focus) {
        previouslyFocused.focus();
      }
    };
  }, [ref, active]);
}

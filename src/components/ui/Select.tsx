import React, { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import styles from './Select.module.css';

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
}

const Select: React.FC<SelectProps> = ({
  label,
  value,
  options,
  onChange,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setFocusedIndex(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setFocusedIndex(0);
      } else {
        setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen) {
        if (focusedIndex >= 0 && focusedIndex < options.length) {
          onChange(options[focusedIndex].value);
        }
        setIsOpen(false);
        setFocusedIndex(-1);
      } else {
        setIsOpen(true);
      }
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  return (
    <div className={clsx(styles.selectWrapper, className)} ref={containerRef}>
      {label && <label className={styles.label}>{label}</label>}
      <div
        className={clsx(styles.selectTrigger, isOpen && styles.open)}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selectedOption ? selectedOption.label : 'Select...'}</span>
        <ChevronDown size={18} className={clsx(styles.chevron, isOpen && styles.chevronOpen)} />
      </div>

      {isOpen && (
        <ul className={styles.optionsList} role="listbox">
          {options.map((opt, index) => (
            <li
              key={opt.value}
              className={clsx(
                styles.optionItem,
                opt.value === value && styles.selected,
                index === focusedIndex && styles.focused
              )}
              onClick={() => handleSelect(opt.value)}
              role="option"
              aria-selected={opt.value === value}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Select;

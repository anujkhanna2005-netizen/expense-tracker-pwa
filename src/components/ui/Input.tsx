import React from 'react';
import type { ReactNode, InputHTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './Input.module.css';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  onChange: (value: string) => void;
}

const Input: React.FC<InputProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  error,
  icon,
  className,
  ...props
}) => {
  return (
    <div className={clsx(styles.inputWrapper, className)}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.inputContainer}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(
            styles.input,
            icon && styles.inputWithIcon,
            error && styles.inputError
          )}
          {...props}
        />
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
};

export default Input;

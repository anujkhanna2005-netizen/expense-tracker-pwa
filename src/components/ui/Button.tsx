import React from 'react';
import type { ReactNode, ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './Button.module.css';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'disabled'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  onClick,
  disabled,
  className,
  ...props
}) => {
  return (
    <button
      className={clsx(
        styles.button,
        styles[variant],
        styles[size],
        loading && styles.loading,
        className
      )}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        <>
          {icon && <span className={styles.icon}>{icon}</span>}
          <span className={styles.content}>{children}</span>
        </>
      )}
    </button>
  );
};

export default Button;

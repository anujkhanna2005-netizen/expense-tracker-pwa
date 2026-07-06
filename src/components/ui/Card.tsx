import React from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './Card.module.css';

interface CardProps {
  variant?: 'flat' | 'elevated' | 'interactive';
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  variant = 'flat',
  children,
  className,
  onClick
}) => {
  return (
    <div
      className={clsx(
        styles.card,
        styles[variant],
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;

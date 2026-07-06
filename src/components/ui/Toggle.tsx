import React from 'react';
import clsx from 'clsx';
import styles from './Toggle.module.css';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  className?: string;
}

const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  ariaLabel,
  className
}) => {
  return (
    <button
      type="button"
      className={clsx(styles.toggle, checked && styles.active, className)}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      aria-label={ariaLabel}
    >
      <div className={styles.knob} />
    </button>
  );
};

export default Toggle;

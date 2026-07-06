import React from 'react';
import clsx from 'clsx';
import styles from './ProgressBar.module.css';

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max: number;
  size?: 'sm' | 'lg';
  colorOverride?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  size = 'sm',
  colorOverride,
  className,
  style,
  ...props
}) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  // Cap visual width at 100% for the bar itself
  const barWidth = Math.min(percentage, 100);

  const getColorClass = () => {
    if (colorOverride) return '';
    if (percentage < 80) return styles.primary;
    if (percentage <= 100) return styles.warning;
    return styles.danger;
  };

  return (
    <div className={clsx(styles.progressContainer, styles[size], className)} style={style} {...props}>
      <div
        className={clsx(styles.progressBar, getColorClass())}
        style={{
          width: `${barWidth}%`,
          backgroundColor: colorOverride || undefined
        }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      />
    </div>
  );
};

export default ProgressBar;

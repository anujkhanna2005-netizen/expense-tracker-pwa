import React from 'react';
import clsx from 'clsx';
import styles from './Skeleton.module.css';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'card' | 'line' | 'circle';
  width?: string | number;
  height?: string | number;
}

const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'line',
  className,
  width,
  height,
  style,
  ...props
}) => {
  const mergedStyle: React.CSSProperties = {
    width: width !== undefined ? width : undefined,
    height: height !== undefined ? height : undefined,
    ...style
  };

  return (
    <div
      className={clsx(
        styles.skeleton,
        styles[variant],
        className
      )}
      style={mergedStyle}
      {...props}
    />
  );
};

export default Skeleton;

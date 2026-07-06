import React from 'react';
import styles from './ErrorFallback.module.css';

interface ErrorFallbackProps {
  onReset: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ onReset }) => {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Something went wrong</h1>
      <p className={styles.message}>
        An unexpected error occurred in the application.
      </p>
      <button className={styles.button} onClick={onReset}>
        Try Again
      </button>
      <span className={styles.note}>
        Don't worry, your data is safe in local storage.
      </span>
    </div>
  );
};

export default ErrorFallback;

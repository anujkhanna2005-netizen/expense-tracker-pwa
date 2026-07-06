import React, { useState } from 'react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Skeleton from '../components/ui/Skeleton';
import ProgressBar from '../components/ui/ProgressBar';
import { useToast } from '../components/ui/ToastProvider';
import { DollarSign, Plus } from 'lucide-react';
import styles from './StyleGuide.module.css';

const StyleGuide: React.FC = () => {
  const { toast } = useToast();
  const [inputText, setInputText] = useState('');
  const [selectValue, setSelectValue] = useState('option-1');
  const [btnLoading, setBtnLoading] = useState(false);

  const selectOptions = [
    { value: 'option-1', label: 'Option One (Default)' },
    { value: 'option-2', label: 'Option Two' },
    { value: 'option-3', label: 'Option Three' }
  ];

  const handleTestLoading = () => {
    setBtnLoading(true);
    setTimeout(() => setBtnLoading(false), 2000);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Design System Foundation</h1>
        <p className={styles.subtitle}>Phase 2 - Style Guide & Visual Component Library</p>
      </header>

      {/* Button section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Buttons</h2>
        <div className={styles.flexRow}>
          <Button variant="primary">Primary Button</Button>
          <Button variant="secondary">Secondary Button</Button>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="danger">Danger Button</Button>
        </div>
        <div className={styles.flexRow}>
          <Button size="sm">Small</Button>
          <Button size="md">Medium (Default)</Button>
          <Button size="lg">Large</Button>
        </div>
        <div className={styles.flexRow}>
          <Button variant="primary" icon={<Plus size={16} />}>With Icon</Button>
          <Button variant="primary" loading={btnLoading} onClick={handleTestLoading}>
            Click to Load
          </Button>
          <Button variant="primary" disabled>Disabled State</Button>
        </div>
      </section>

      {/* Card section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Cards</h2>
        <div className={styles.grid}>
          <Card variant="flat">
            <div className={styles.cardContent}>
              <span className={styles.cardTitle}>Flat Card</span>
              <span className={styles.cardText}>Simple background with a subtle border.</span>
            </div>
          </Card>
          <Card variant="elevated">
            <div className={styles.cardContent}>
              <span className={styles.cardTitle}>Elevated Card</span>
              <span className={styles.cardText}>Features a soft, premium shadow overlay.</span>
            </div>
          </Card>
          <Card variant="interactive" onClick={() => toast('Interactive card clicked!', 'success')}>
            <div className={styles.cardContent}>
              <span className={styles.cardTitle}>Interactive Card</span>
              <span className={styles.cardText}>Lifts on hover and responds to pointer events. Click me to trigger a Toast!</span>
            </div>
          </Card>
        </div>
      </section>

      {/* Input section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Form Inputs</h2>
        <div className={styles.grid}>
          <Input
            label="Standard Input"
            placeholder="Type something..."
            value={inputText}
            onChange={setInputText}
          />
          <Input
            label="Input with Icon"
            placeholder="Search or enter amount..."
            icon={<DollarSign size={16} />}
            value={inputText}
            onChange={setInputText}
          />
          <Input
            label="Input with Validation Error"
            placeholder="Should fail validation..."
            error={inputText.length < 3 ? 'Text must be at least 3 characters long' : undefined}
            value={inputText}
            onChange={setInputText}
          />
        </div>
      </section>

      {/* Select section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Custom Select Dropdown</h2>
        <div style={{ maxWidth: '320px' }}>
          <Select
            label="Custom Select Options"
            value={selectValue}
            options={selectOptions}
            onChange={setSelectValue}
          />
        </div>
      </section>

      {/* Toast section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Toasts & Feedback</h2>
        <div className={styles.flexRow}>
          <Button variant="secondary" onClick={() => toast('Information message dispatched.', 'info')}>
            Trigger Info Toast
          </Button>
          <Button variant="primary" onClick={() => toast('Action completed successfully!', 'success')}>
            Trigger Success Toast
          </Button>
          <Button variant="danger" onClick={() => toast('Transaction failed. Please check details.', 'error')}>
            Trigger Error Toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast('Deleted expense record', 'info', {
                label: 'Undo',
                onClick: () => alert('Action undone!')
              })
            }
          >
            Trigger Action Toast (Undo)
          </Button>
        </div>
      </section>

      {/* Progress Bar section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Progress Bars</h2>
        <div className={styles.section}>
          <div>
            <label className={styles.cardText}>Primary state (&lt;80% progress):</label>
            <ProgressBar value={40} max={100} size="sm" />
          </div>
          <div>
            <label className={styles.cardText}>Warning state (80%-100% progress):</label>
            <ProgressBar value={90} max={100} size="lg" />
          </div>
          <div>
            <label className={styles.cardText}>Danger state (&gt;100% progress):</label>
            <ProgressBar value={120} max={100} size="sm" />
          </div>
          <div>
            <label className={styles.cardText}>Color Override State:</label>
            <ProgressBar value={70} max={100} size="lg" colorOverride="var(--color-secondary)" />
          </div>
        </div>
      </section>

      {/* Skeleton placeholders */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Skeletons (Placeholders)</h2>
        <div className={styles.flexRow} style={{ alignItems: 'flex-start' }}>
          <Skeleton variant="circle" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Skeleton variant="line" width="40%" height={20} />
            <Skeleton variant="line" width="80%" height={16} />
            <Skeleton variant="line" width="60%" height={12} />
          </div>
        </div>
        <div style={{ maxWidth: '350px' }}>
          <Skeleton variant="card" />
        </div>
      </section>
    </div>
  );
};

export default StyleGuide;

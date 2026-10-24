import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '../utils/format';
import styles from './CategoryDonutChart.module.css';

const JEWEL_COLORS = [
  '#0F766E', // Emerald teal
  '#D97706', // Food amber
  '#2563EB', // Bills blue
  '#059669', // Groceries jade
  '#7C3AED', // Shopping purple
  '#EA580C', // Fuel orange
  '#DB2777', // Health rose
  '#0284C7', // Subscriptions sky
];

interface ChartDataEntry {
  id: string;
  name: string;
  amount: number;
}

interface CategoryDonutChartProps {
  data: ChartDataEntry[];
  currency: string;
}

const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({ data, currency }) => {
  const chartData = useMemo(() => {
    return data.map((cat, index) => ({
      name: cat.name,
      value: cat.amount,
      fill: JEWEL_COLORS[index % JEWEL_COLORS.length],
    }));
  }, [data]);

  const totalAmount = useMemo(() => {
    return data.reduce((sum, d) => sum + d.amount, 0);
  }, [data]);

  if (data.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No category spending to display</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.chartWrapper}>
        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={88}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) => [formatCurrency(Number(value), currency), 'Amount']}
                contentStyle={{
                  backgroundColor: 'var(--surface-card)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  color: 'var(--ink-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Centered Donut Total Stat */}
          <div className={styles.centerStat}>
            <span className={styles.centerLabel}>Total</span>
            <span className={styles.centerValue}>{formatCurrency(totalAmount, currency)}</span>
            <span className={styles.centerSubtext}>{data.length} Categories</span>
          </div>
        </div>
      </div>

      <div className={styles.legend}>
        {chartData.map((entry, index) => {
          const percent = totalAmount > 0 ? ((entry.value / totalAmount) * 100).toFixed(1) : '0';
          return (
            <div key={index} className={styles.legendItem}>
              <div className={styles.legendColor} style={{ backgroundColor: entry.fill }} />
              <div className={styles.legendDetails}>
                <span className={styles.legendLabel}>{entry.name}</span>
                <span className={styles.legendAmount}>
                  {formatCurrency(entry.value, currency)} <span className={styles.legendPercent}>({percent}%)</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryDonutChart;

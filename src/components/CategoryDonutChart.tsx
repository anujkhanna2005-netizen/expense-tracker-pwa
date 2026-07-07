import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '../utils/format';
import styles from './CategoryDonutChart.module.css';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];

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
      fill: COLORS[index % COLORS.length]
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No data to display</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any) => [formatCurrency(Number(value), currency), 'Amount']}
              contentStyle={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
                color: 'var(--text-primary)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.legend}>
        {chartData.map((entry, index) => (
          <div key={index} className={styles.legendItem}>
            <div className={styles.legendColor} style={{ backgroundColor: entry.fill }} />
            <span className={styles.legendLabel}>{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoryDonutChart;

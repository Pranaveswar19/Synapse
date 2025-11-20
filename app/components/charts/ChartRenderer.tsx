'use client';

import { motion } from 'framer-motion';
import LineChart from './LineChart';
import BarChart from './BarChart';
import PieChart from './PieChart';
import { ChartData } from '@/app/types/chart';

interface ChartRendererProps {
  chartData: ChartData;
}

export default function ChartRenderer({ chartData }: ChartRendererProps) {
  const { chartType, data, xKey, yKeys, title, description } = chartData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="my-4"
    >
      <div className="mb-2">
        <p className="text-sm text-gray-600">{description}</p>
      </div>

      {chartType === 'line' && (
        <LineChart data={data} xKey={xKey} yKeys={yKeys} title={title} />
      )}

      {chartType === 'bar' && (
        <BarChart data={data} xKey={xKey} yKeys={yKeys} title={title} />
      )}

      {chartType === 'pie' && (
        <PieChart data={data} xKey={xKey} yKeys={yKeys} title={title} />
      )}

      {chartType === 'area' && (
        // Area chart is similar to line chart for now
        <LineChart data={data} xKey={xKey} yKeys={yKeys} title={title} />
      )}
    </motion.div>
  );
}
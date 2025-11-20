export interface ChartData {
  type: 'CHART';
  chartType: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  data: Array<{ [key: string]: string | number }>;
  xKey: string;
  yKeys: string[];
  description: string;
}

export function isChartData(content: string): ChartData | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.type === 'CHART' && parsed.chartType && parsed.data) {
      return parsed as ChartData;
    }
    return null;
  } catch {
    return null;
  }
}
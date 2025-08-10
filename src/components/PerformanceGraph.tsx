import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

interface PerformanceData {
  name: string;
  accuracy: number;
}

interface PerformanceGraphProps {
  data: PerformanceData[];
}

const getBarColor = (accuracy: number) => {
  if (accuracy < 60) return '#ef4444'; // red-500
  if (accuracy < 85) return '#f59e0b'; // amber-500
  return '#22c55e'; // green-500
};

export const PerformanceGraph = ({ data }: PerformanceGraphProps) => {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-[300px] text-muted-foreground">Not enough review data to display a graph.</div>;
  }

  const sortedData = [...data].sort((a, b) => a.accuracy - b.accuracy);

  return (
    <ResponsiveContainer width="100%" height={300 + sortedData.length * 10}>
      <BarChart data={sortedData} layout="vertical" margin={{ top: 5, right: 40, left: 20, bottom: 5 }}>
        <XAxis type="number" domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} interval={0} />
        <Tooltip formatter={(value) => [`${(value as number).toFixed(1)}%`, 'Accuracy']} />
        <Bar dataKey="accuracy">
          <LabelList dataKey="accuracy" position="right" formatter={(value: number) => `${value.toFixed(1)}%`} fontSize={12} />
          {sortedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.accuracy)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
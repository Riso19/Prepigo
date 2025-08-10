import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

interface DifficultyTrendData {
  date: string;
  avgDifficulty: number;
}

interface DifficultyTrendChartProps {
  data: DifficultyTrendData[];
}

export const DifficultyTrendChart = ({ data }: DifficultyTrendChartProps) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} />
        <Tooltip formatter={(value) => [`${(value as number).toFixed(1)}%`, 'Avg. Difficulty']} />
        <Legend verticalAlign="top" height={36} />
        <Line type="monotone" dataKey="avgDifficulty" name="Avg. Difficulty" stroke="#ffc658" />
      </LineChart>
    </ResponsiveContainer>
  );
};
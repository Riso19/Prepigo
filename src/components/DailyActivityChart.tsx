import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

interface DailyActivityData {
  date: string;
  reviews: number;
  accuracy: number;
}

interface DailyActivityChartProps {
  data: DailyActivityData[];
}

export const DailyActivityChart = ({ data }: DailyActivityChartProps) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis yAxisId="left" label={{ value: 'Reviews', angle: -90, position: 'insideLeft' }} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} label={{ value: 'Accuracy', angle: 90, position: 'insideRight' }} />
        <Tooltip />
        <Legend verticalAlign="top" height={36} />
        <Line yAxisId="left" type="monotone" dataKey="reviews" name="Reviews" stroke="#8884d8" />
        <Line yAxisId="right" type="monotone" dataKey="accuracy" name="Accuracy" stroke="#82ca9d" />
      </LineChart>
    </ResponsiveContainer>
  );
};
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface ReviewTimeData {
  name: string;
  count: number;
}

interface ReviewTimeDistributionChartProps {
  data: ReviewTimeData[];
}

export const ReviewTimeDistributionChart = ({ data }: ReviewTimeDistributionChartProps) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
        <Tooltip />
        <Bar dataKey="count" name="Reviews" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
};
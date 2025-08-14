import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, CartesianGrid } from 'recharts';

interface TopicForgettingRateData {
  name: string;
  forgetRate: number;
}

interface TopicForgettingRateChartProps {
  data: TopicForgettingRateData[];
}

const getBarColor = (forgetRate: number) => {
  if (forgetRate > 40) return '#ef4444'; // red-500
  if (forgetRate > 20) return '#f59e0b'; // amber-500
  return '#22c55e'; // green-500
};

const CustomYAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const MAX_LENGTH = 25;
  const truncatedValue = payload.value.length > MAX_LENGTH ? `${payload.value.substring(0, MAX_LENGTH - 2)}...` : payload.value;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize={12}>
        {truncatedValue}
      </text>
    </g>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-foreground break-all">{label}</p>
          <p className="text-sm text-muted-foreground">
            Forget Rate: 
            <span className="font-bold ml-2" style={{ color: getBarColor(payload[0].value) }}>
              {`${(payload[0].value as number).toFixed(1)}%`}
            </span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export const TopicForgettingRateChart = ({ data }: TopicForgettingRateChartProps) => {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-[300px] text-muted-foreground">Not enough data to display a graph.</div>;
  }

  const sortedData = [...data].sort((a, b) => a.forgetRate - b.forgetRate);
  const barHeight = 30;
  const chartHeight = sortedData.length * barHeight;

  return (
    <div className="w-full h-[400px] overflow-y-auto">
      <ResponsiveContainer width="100%" height={Math.max(400, chartHeight)}>
        <BarChart data={sortedData} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} />
          <YAxis type="category" dataKey="name" tick={<CustomYAxisTick />} width={150} interval={0} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
          <Bar dataKey="forgetRate" barSize={barHeight - 10}>
            <LabelList dataKey="forgetRate" position="right" formatter={(value: number) => `${value.toFixed(1)}%`} fontSize={12} fill="hsl(var(--foreground))" />
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.forgetRate)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
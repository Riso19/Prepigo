import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, CartesianGrid } from 'recharts';

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

interface CustomYAxisTickProps {
  x?: number;
  y?: number;
  payload?: {
    value: string;
  };
}

const CustomYAxisTick = (props: CustomYAxisTickProps) => {
  const { x, y, payload } = props;
  const MAX_LENGTH = 25;
  const truncatedValue = payload?.value && payload.value.length > MAX_LENGTH ? `${payload.value.substring(0, MAX_LENGTH - 2)}...` : payload?.value || '';
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize={12}>
        {truncatedValue}
      </text>
    </g>
  );
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: PerformanceData;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-foreground break-all">{label}</p>
          <p className="text-sm text-muted-foreground">
            Accuracy: 
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

export const PerformanceGraph = ({ data }: PerformanceGraphProps) => {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-[300px] text-muted-foreground">Not enough review data to display a graph.</div>;
  }

  const sortedData = [...data].sort((a, b) => a.accuracy - b.accuracy);
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
          <Bar dataKey="accuracy" barSize={barHeight - 10}>
            <LabelList dataKey="accuracy" position="right" formatter={(value: number) => `${value.toFixed(1)}%`} fontSize={12} fill="hsl(var(--foreground))" />
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.accuracy)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { format } from 'date-fns';

interface StabilityTrendData {
  date: string;
  avgStability: number;
}

interface StabilityTrendChartProps {
  data: StabilityTrendData[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: StabilityTrendData;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-foreground">{format(new Date(label), 'PPP')}</p>
          <p className="text-sm text-muted-foreground">
            Avg. Stability: 
            <span className="font-bold ml-2 text-primary">
              {`${(payload[0].value as number).toFixed(1)} days`}
            </span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export const StabilityTrendChart = ({ data }: StabilityTrendChartProps) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          tickFormatter={(dateStr) => format(new Date(dateStr), 'MMM d')}
          minTickGap={20}
        />
        <YAxis 
          label={{ value: 'Avg. Stability (days)', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend verticalAlign="top" height={36} />
        <Line 
          type="monotone" 
          dataKey="avgStability" 
          name="Average Stability"
          stroke="#8884d8" 
          strokeWidth={2} 
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
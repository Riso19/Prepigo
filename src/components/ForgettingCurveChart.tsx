import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

interface ForgettingCurveData {
  interval: number;
  accuracy: number;
  reviews: number;
}

interface ForgettingCurveChartProps {
  data: ForgettingCurveData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-foreground">{`${label} days`}</p>
          <p className="text-sm text-muted-foreground">
            Accuracy: 
            <span className="font-bold ml-2 text-primary">
              {`${(payload[0].value as number).toFixed(1)}%`}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Reviews: 
            <span className="font-bold ml-2 text-primary">
              {payload[0].payload.reviews}
            </span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export const ForgettingCurveChart = ({ data }: ForgettingCurveChartProps) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="interval" 
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(tick) => `${tick}d`}
          label={{ value: 'Days Since Last Review', position: 'insideBottom', offset: -5 }}
        />
        <YAxis 
          domain={[0, 100]} 
          tickFormatter={(tick) => `${tick}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend verticalAlign="top" height={36} />
        <Line 
          type="monotone" 
          dataKey="accuracy" 
          name="Actual Retention"
          stroke="#8884d8" 
          strokeWidth={2} 
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
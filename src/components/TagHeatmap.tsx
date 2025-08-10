import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TagAnalytics {
  tag: string;
  accuracy: number;
  reviews: number;
}

interface TagHeatmapProps {
  tags: TagAnalytics[];
}

const getHeatmapColor = (accuracy: number) => {
  const hue = (accuracy / 100) * 120; // 0 (red) to 120 (green)
  return `hsl(${hue}, 70%, 45%)`;
};

export const TagHeatmap = ({ tags }: TagHeatmapProps) => {
  if (tags.length === 0) {
    return <p className="text-sm text-muted-foreground">Not enough review data for a heatmap.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map(({ tag, accuracy, reviews }) => (
        <Tooltip key={tag}>
          <TooltipTrigger asChild>
            <div
              className="rounded-md px-2.5 py-1 text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: getHeatmapColor(accuracy) }}
            >
              {tag}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Accuracy: {accuracy.toFixed(1)}%</p>
            <p>Reviews: {reviews}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};
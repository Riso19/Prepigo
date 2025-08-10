import { useDynamicRelativeTime } from '@/hooks/useDynamicRelativeTime';
import { cn } from '@/lib/utils';
import { isPast } from 'date-fns';
import { Badge } from './ui/badge';

interface DynamicDueDateProps {
  dueDate?: string;
  isNew: boolean;
  isSuspended?: boolean;
}

export const DynamicDueDate = ({ dueDate, isNew, isSuspended }: DynamicDueDateProps) => {
  const relativeTime = useDynamicRelativeTime(dueDate);

  if (isSuspended) {
    return <Badge variant="outline">Suspended</Badge>;
  }

  if (isNew || !dueDate) {
    return <Badge variant="secondary">New</Badge>;
  }

  const isDue = isPast(new Date(dueDate));

  return (
    <span className={cn("text-sm", isDue && "text-red-500 font-semibold")}>
      {relativeTime}
    </span>
  );
};
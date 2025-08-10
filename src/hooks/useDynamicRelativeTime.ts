import { useState, useEffect } from 'react';
import { formatDistanceToNow, isPast, differenceInSeconds } from 'date-fns';

const formatRelativeTime = (date: Date): string => {
  if (isPast(date)) {
    return "Due now";
  }

  const seconds = differenceInSeconds(date, new Date());

  if (seconds < 60) {
    return `in ${seconds}s`;
  }
  if (seconds < 3600) {
    return `in ${Math.round(seconds / 60)}m`;
  }
  if (seconds < 86400) {
    return `in ${Math.round(seconds / 3600)}h`;
  }
  
  return formatDistanceToNow(date, { addSuffix: true });
};

export const useDynamicRelativeTime = (dateString?: string) => {
  const [relativeTime, setRelativeTime] = useState('');

  useEffect(() => {
    if (!dateString) {
      setRelativeTime('');
      return;
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        setRelativeTime('Invalid date');
        return;
    }

    const update = () => {
      setRelativeTime(formatRelativeTime(date));
    };

    update();

    const secondsUntilDue = differenceInSeconds(date, new Date());
    let intervalId: NodeJS.Timeout;

    if (secondsUntilDue > 0) {
      if (secondsUntilDue < 60) {
        // Update every second if due in less than a minute
        intervalId = setInterval(update, 1000);
      } else if (secondsUntilDue < 3600) {
        // Update every minute if due in less than an hour
        intervalId = setInterval(update, 60 * 1000);
      } else {
        // Update every hour for longer durations
        intervalId = setInterval(update, 60 * 60 * 1000);
      }
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [dateString]);

  return relativeTime;
};
import { useEffect, useMemo, useState } from 'react';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCheck, Loader2, WifiOff, AlertTriangle, LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

// Minimal, non-distracting sync indicator:
// - Hidden when idle (unless just synced within 2s)
// - Icon-only with tooltip for details
// - Colors: blue (syncing), yellow (offline), red (error), green (just synced)
export default function SyncStatusIndicator({ className }: { className?: string }) {
  const { state, online } = useSyncStatus();
  const [now, setNow] = useState<number>(Date.now());

  // Tick every 1s only when in error to keep countdown fresh
  useEffect(() => {
    if (state.status !== 'error') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.status]);

  const recentlySynced = useMemo(() => {
    if (state.status !== 'idle' || !state.lastCompletedAt) return false;
    return Date.now() - state.lastCompletedAt < 2000;
  }, [state]);

  // Auto-hide when idle and not recently synced
  if (online && state.status === 'idle' && !recentlySynced) return null;

  let Icon: React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>> | null = null;
  let tone = '';
  let tooltip = '';

  if (!online) {
    Icon = WifiOff;
    tone = 'text-yellow-600';
    tooltip = 'Offline: changes will sync when you are back online';
  } else if (state.status === 'syncing') {
    Icon = Loader2;
    tone = 'text-blue-600 animate-spin';
    tooltip = 'Syncing…';
  } else if (state.status === 'error') {
    Icon = AlertTriangle;
    tone = 'text-red-600';
    const seconds = Math.max(1, Math.ceil(state.delay / 1000 - (Date.now() - now) / 1000));
    tooltip = `Sync error. Retrying in ~${seconds}s (attempt ${state.attempt})`;
  } else if (recentlySynced) {
    Icon = CheckCheck;
    tone = 'text-green-600';
    tooltip = 'All changes synced';
  }

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <div
          aria-live="polite"
          className={cn(
            'h-8 w-8 rounded-full bg-background shadow border flex items-center justify-center text-muted-foreground',
            tone,
            className,
            'pointer-events-auto'
          )}
          role="status"
          aria-label={tooltip}
        >
          {Icon ? <Icon className="h-4 w-4" /> : null}
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
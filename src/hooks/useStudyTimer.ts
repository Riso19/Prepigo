import { useEffect, useRef } from 'react';
import { useGamification } from '@/contexts/GamificationContext';

// Active study timer that periodically adds study time to gamification stats while the page is active.
// - Pauses when the tab is hidden or user is idle for > idleThresholdMs
// - Flushes increments every tickMs and on unmount
// Note: Pages should NOT also add per-question time to avoid double counting.
export function useStudyTimer(options?: {
  tickMs?: number; // how often to flush, default 15000ms
  idleThresholdMs?: number; // how long without user input to consider idle, default 60000ms
}) {
  const { updateStats } = useGamification();
  const tickMs = options?.tickMs ?? 15000;
  const idleThresholdMs = options?.idleThresholdMs ?? 60000;

  const lastActiveRef = useRef<number>(Date.now());
  const lastTickRef = useRef<number>(Date.now());
  const intervalRef = useRef<number | null>(null);

  // Track user activity to reset idle timer
  useEffect(() => {
    const markActive = () => {
      lastActiveRef.current = Date.now();
    };
    const winEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'pointermove',
      'keydown',
      'wheel',
      'touchstart',
      'focus',
    ];
    const docEvents: Array<keyof DocumentEventMap> = ['visibilitychange'];

    winEvents.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));
    docEvents.forEach((evt) =>
      document.addEventListener(evt, markActive, { passive: true } as AddEventListenerOptions),
    );
    return () => {
      winEvents.forEach((evt) => window.removeEventListener(evt, markActive));
      docEvents.forEach((evt) => document.removeEventListener(evt, markActive));
    };
  }, []);

  // Main interval loop using delta updates
  useEffect(() => {
    const isActive = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return false;
      const now = Date.now();
      return now - lastActiveRef.current < idleThresholdMs;
    };

    const deltaTick = async () => {
      const now = Date.now();
      const elapsedMs = now - lastTickRef.current;
      lastTickRef.current = now;

      if (!isActive()) return;

      const minutesDelta = elapsedMs / 60000;
      if (minutesDelta <= 0) return;
      await updateStats({ __delta_totalStudyTimeMinutes: minutesDelta } as unknown as Partial<
        import('@/data/gamification').UserStats
      >);
    };

    intervalRef.current = window.setInterval(deltaTick, tickMs);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      // Final flush on unmount
      void deltaTick();
    };
  }, [tickMs, idleThresholdMs, updateStats]);
}

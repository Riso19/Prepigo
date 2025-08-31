import { useEffect, useState } from 'react';
import { subscribe } from '@/lib/broadcast';

export type SyncState =
  | { status: 'idle'; lastCompletedAt?: number }
  | { status: 'syncing' }
  | { status: 'error'; attempt: number; delay: number };

export function useSyncStatus() {
  const [state, setState] = useState<SyncState>({ status: 'idle' });
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'sync-scheduled') setState({ status: 'syncing' });
      if (msg.type === 'sync-complete') setState({ status: 'idle', lastCompletedAt: Date.now() });
      if (msg.type === 'sync-error') setState({ status: 'error', attempt: msg.attempt, delay: msg.delay });
    });
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      if (unsub) {
        unsub();
      }
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return { state, online };
}
import { useEffect } from 'react';
import { setPushHandler, startSync, stopSync } from '@/lib/sync';
import { postMessage } from '@/lib/broadcast';
import { saveConflict, computeFieldConflicts } from '@/lib/conflict';

interface SyncOperation<T = unknown> {
  id: string;
  resource: string;
  opType: string;
  payload: T;
}

interface Conflict<T = unknown> {
  resource: string;
  id: string;
  local: T;
  server: T;
}

interface SyncResult<T = unknown> {
  syncedIds: number[];
  conflicts?: Conflict<T>[];
}

// Minimal provider that initializes background sync with a no-op push handler.
// Replace the push handler with a real server call when backend is ready.
export default function SyncProvider() {
  useEffect(() => {
    setPushHandler(async <T,>(ops: SyncOperation<T>[]) => {
      // TODO: Replace with real API call. Contract:
      // return { syncedIds: number[], conflicts?: Array<{resource:string,id:string,local:any,server:any}> }
      const ids = ops.map((o) => o?.id).filter((id): id is string => id != null);
      const result: SyncResult<T> = {
        syncedIds: ids.map((_, index) => index),
      };

      // If backend reports conflicts, persist them for UI
      if (result.conflicts?.length) {
        for (const c of result.conflicts) {
          const fields = computeFieldConflicts(c.local, c.server);
          await saveConflict(c.resource, c.id, c.local, c.server, fields);
        }
      }

      postMessage({ type: 'sync-scheduled' });
      postMessage({ type: 'sync-complete' });
      return { syncedIds: result.syncedIds };
    });

    startSync();
    return () => {
      stopSync();
    };
  }, []);

  return null;
}
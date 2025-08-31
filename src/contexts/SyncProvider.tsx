import { useEffect } from 'react';
import { setPushHandler, startSync, stopSync, type PushHandler } from '@/lib/sync';
import { postMessage } from '@/lib/broadcast';
import { saveConflict, computeFieldConflicts } from '@/lib/conflict';

// Minimal provider that initializes background sync with a no-op push handler.
// Replace the push handler with a real server call when backend is ready.
export default function SyncProvider() {
  useEffect(() => {
    const handler: PushHandler = async (ops) => {
      // TODO: Replace with real API call. Contract:
      // return { syncedIds: number[], conflicts?: Array<{resource:string,id:string,local:any,server:any}> }
      const syncedIds = ops.map((_, index) => index);
      const conflicts: Array<{resource: string; id: string; local: unknown; server: unknown}> = [];

      // Process operations and collect conflicts if any
      // In a real implementation, this would be replaced with actual API calls
      for (const op of ops) {
        // Simulate a conflict for testing
        if (Math.random() > 0.5) {
          // Create a new object with the payload and add an updated timestamp
          const serverPayload = op.payload && typeof op.payload === 'object' 
            ? { ...op.payload as Record<string, unknown>, updated: new Date().toISOString() }
            : { value: op.payload, updated: new Date().toISOString() };
            
          conflicts.push({
            resource: op.resource,
            id: String(op.id || ''),
            local: op.payload,
            server: serverPayload // Simulate server changes
          });
        }
      }

      // If there are conflicts, save them
      if (conflicts.length > 0) {
        for (const c of conflicts) {
          const fields = computeFieldConflicts(c.local, c.server);
          await saveConflict(c.resource, c.id, c.local, c.server, fields);
        }
      }

      postMessage({ type: 'sync-scheduled' });
      postMessage({ type: 'sync-complete' });
      return { syncedIds };
    };

    setPushHandler(handler);

    startSync();
    return () => {
      stopSync();
    };
  }, []);

  return null;
}
// Background sync processor (operation-based) with exponential backoff + jitter
// Non-invasive: not auto-started; caller controls lifecycle.

/*
Operation shape (queued in Dexie via enqueueSyncOp):
{
  id?: number,
  resource: string,
  opType: 'create' | 'update' | 'delete' | string,
  payload: any,
  createdAt?: number,
  retryCount?: number
}
*/

export interface SyncOperation {
  id?: number;
  resource: string;
  opType: string;
  payload: unknown;
  createdAt?: number;
  retryCount?: number;
}

import { table } from './dexie-db';
import { postMessage } from './broadcast';

// Constants
const SYNC_OPS_STORE = 'sync-ops';
const META_STORE = 'meta';

// Helper functions for sync operations
async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  const t = await table<{ key: string; value: T }>(META_STORE);
  const result = await t.get(key);
  return result?.value;
}

async function setMeta<T = unknown>(key: string, value: T): Promise<void> {
  const t = await table<{ key: string; value: T }>(META_STORE);
  await t.put({ key, value }, key);
}

async function takeSyncBatch(limit = 20): Promise<SyncOperation[]> {
  const t = await table<SyncOperation>(SYNC_OPS_STORE);
  // Get all operations and then take the first 'limit' items
  const allOps = await t.toArray();
  return allOps.slice(0, limit);
}

async function markOpsAsSynced(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const t = await table<SyncOperation>(SYNC_OPS_STORE);
  await t.bulkDelete(ids);
}

export type PushHandler = (ops: SyncOperation[]) => Promise<{ syncedIds: number[] } | void>;

let running = false;
let stopped = true;
let currentTimer: ReturnType<typeof setTimeout> | null = null;
let pushHandler: PushHandler | null = null;

function backoffDelay(attempt: number, base = 1000, max = 30_000) {
  const exp = Math.min(max, base * Math.pow(2, attempt));
  const jitter = Math.floor(Math.random() * (exp * 0.2));
  return exp + jitter; // ms
}

export function setPushHandler(handler: PushHandler) {
  pushHandler = handler;
}

export async function scheduleSyncNow() {
  if (!running || stopped) return;
  if (currentTimer) {
    clearTimeout(currentTimer);
    currentTimer = null;
  }
  // Kick the loop immediately by running one iteration
  void loopOnce();
}

export function startSync() {
  if (running) return;
  running = true;
  stopped = false;
  // Listen for connectivity changes
  if (typeof window !== 'undefined') {
    window.addEventListener('online', scheduleSyncNow);
  }
  // Start loop
  void loopOnce();
}

export function stopSync() {
  stopped = true;
  running = false;
  if (currentTimer) {
    clearTimeout(currentTimer);
    currentTimer = null;
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', scheduleSyncNow);
  }
}

async function loopOnce() {
  if (stopped) return;
  let attempt: number = ((await getMeta('sync_attempt')) as number | undefined) ?? 0;
  try {
    const batch = (await takeSyncBatch(20)) as SyncOperation[];
    if (!batch.length) {
      // Nothing to do; slow down polling modestly
      currentTimer = setTimeout(() => void loopOnce(), 5000);
      return;
    }

    if (!pushHandler) {
      // No handler wired; retry later without marking failure
      currentTimer = setTimeout(() => void loopOnce(), 5000);
      return;
    }

    // Announce a sync cycle is starting
    postMessage({ type: 'sync-scheduled' });

    const res = await pushHandler(batch);
    const syncedIds =
      res?.syncedIds ?? batch.map((b) => b.id).filter((id): id is number => id != null);
    // Mark successful ones as synced
    if (syncedIds.length) {
      await markOpsAsSynced(syncedIds);
    }

    // Reset attempt counter on success
    attempt = 0;
    await setMeta('sync_attempt', attempt);

    // Loop again soon for remaining ops
    currentTimer = setTimeout(() => void loopOnce(), 250);

    // Announce sync completion
    postMessage({ type: 'sync-complete' });
  } catch (e) {
    // Increment attempt and retry later with backoff
    attempt = (attempt || 0) + 1;
    await setMeta('sync_attempt', attempt);
    const delay = backoffDelay(attempt);
    // Announce backoff state for status indicator
    postMessage({ type: 'sync-error', attempt, delay });
    currentTimer = setTimeout(() => void loopOnce(), delay);
  }
}

// Simple BroadcastChannel helper for multi-tab notifications

const CHANNEL_NAME = 'prepigo-sync';

export type BroadcastEvent =
  | { type: 'storage-write'; resource: string; id?: string }
  | { type: 'sync-scheduled' }
  | { type: 'sync-complete' }
  | { type: 'sync-error'; attempt: number; delay: number };

let bc: BroadcastChannel | null = null;

function getChannel() {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (!bc) bc = new BroadcastChannel(CHANNEL_NAME);
  return bc;
}

export function postMessage(msg: BroadcastEvent) {
  const ch = getChannel();
  if (!ch) return;
  ch.postMessage(msg);
}

export function subscribe(handler: (msg: BroadcastEvent) => void) {
  const ch = getChannel();
  if (!ch) return () => {};
  const listener = (e: MessageEvent) => handler(e.data);
  ch.addEventListener('message', listener);
  return () => ch.removeEventListener('message', listener);
}
import { getMeta, setMeta, listMetaKeys, deleteMeta } from '@/lib/storage';
import { getAllExamsFromDB, saveExamsToDB } from '@/lib/storage';

const PREFIX = 'conflict::';

export type ConflictRecord<T = unknown> = {
  key: string;
  resource: string;
  id: string;
  local: T;
  server: T;
  fields?: string[]; // fields that appear conflicting
  createdAt: number;
};

function conflictKey(resource: string, id: string) {
  return `${PREFIX}${resource}::${id}`;
}

export async function saveConflict<T>(resource: string, id: string, local: T, server: T, fields?: string[]) {
  const key = conflictKey(resource, id);
  const rec: ConflictRecord<T> = { key, resource, id, local, server, fields, createdAt: Date.now() };
  await setMeta(key, rec);
  return rec;
}

export async function getConflict<T>(resource: string, id: string) {
  return (await getMeta(conflictKey(resource, id))) as ConflictRecord<T> | undefined;
}

export async function listConflicts<T>(resource?: string): Promise<ConflictRecord<T>[]> {
  const prefix = resource ? `${PREFIX}${resource}::` : PREFIX;
  const keys = await listMetaKeys(prefix);
  const results: ConflictRecord<T>[] = [];
  for (const k of keys) {
    const rec = (await getMeta(k)) as ConflictRecord<T> | undefined;
    if (rec) results.push(rec);
  }
  // sort by createdAt desc
  results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return results;
}

export async function deleteConflict(resource: string, id: string) {
  await deleteMeta(conflictKey(resource, id));
}

export function computeFieldConflicts(local: unknown, server: unknown): string[] {
  const keys = Array.from(new Set([...(Object.keys(local || {})), ...(Object.keys(server || {}))]));
  return keys.filter((k) => JSON.stringify(local?.[k as keyof typeof local]) !== JSON.stringify(server?.[k as keyof typeof server]));
}

export function resolveKeepLocal<T>(local: T): T {
  return structuredClone(local);
}

export function resolveKeepServer<T>(server: T): T {
  return structuredClone(server);
}

// Apply chosen resolution to storage for known resources
export async function applyResolution<T extends { id: string; name: string; date: string; deckIds: string[]; questionBankIds: string[]; tags: string[]; tagFilterType: 'all' | 'any'; filterMode: 'all' | 'due' | 'difficulty'; filterDifficultyMin?: number; filterDifficultyMax?: number }>(
  resource: string, 
  id: string, 
  resolved: T
) {
  if (resource === 'exams') {
    const all = await getAllExamsFromDB();
    const idx = all.findIndex((e) => e.id === id);
    if (idx >= 0) {
      all[idx] = resolved;
    } else {
      all.push(resolved);
    }
    await saveExamsToDB(all);
    return;
  }
  // For unknown resources, just store the resolution inside conflict for consumers to pick up.
  await setMeta(conflictKey(resource, id) + '::resolved', resolved);
}

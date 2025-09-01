import { table } from '@/lib/dexie-db';

const META_STORE = 'meta';

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

async function setMeta<T = unknown>(key: string, value: T): Promise<void> {
  const t = await table<{ key: string; value: T }>(META_STORE);
  await t.put({ key, value }, key);
}

async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  const t = await table<{ key: string; value: T }>(META_STORE);
  const result = await t.get(key);
  return result?.value;
}

async function listMetaKeys(prefix: string): Promise<string[]> {
  const t = await table<{ key: string }>(META_STORE);
  const allItems = await t.toArray();
  return allItems.filter((item) => item.key?.startsWith(prefix)).map((item) => item.key);
}

async function deleteMeta(key: string): Promise<void> {
  const t = await table<{ key: string }>(META_STORE);
  await t.delete(key);
}

export async function saveConflict<T>(
  resource: string,
  id: string,
  local: T,
  server: T,
  fields?: string[],
) {
  const key = conflictKey(resource, id);
  const rec: ConflictRecord<T> = {
    key,
    resource,
    id,
    local,
    server,
    fields,
    createdAt: Date.now(),
  };
  await setMeta(key, rec);
  return rec;
}

export async function getConflict<T>(resource: string, id: string) {
  return await getMeta<ConflictRecord<T>>(conflictKey(resource, id));
}

export async function listConflicts<T>(resource?: string): Promise<ConflictRecord<T>[]> {
  const prefix = resource ? `${PREFIX}${resource}::` : PREFIX;
  const keys = await listMetaKeys(prefix);
  const results: ConflictRecord<T>[] = [];
  for (const k of keys) {
    const rec = await getMeta<ConflictRecord<T>>(k);
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
  const keys = Array.from(new Set([...Object.keys(local || {}), ...Object.keys(server || {})]));
  return keys.filter(
    (k) =>
      JSON.stringify(local?.[k as keyof typeof local]) !==
      JSON.stringify(server?.[k as keyof typeof server]),
  );
}

export function resolveKeepLocal<T>(local: T): T {
  return structuredClone(local);
}

export function resolveKeepServer<T>(server: T): T {
  return structuredClone(server);
}

// Apply chosen resolution to storage for known resources
export async function applyResolution<T>(resource: string, id: string, resolved: T) {
  // Delete conflict record
  await deleteConflict(resource, id);

  // Apply resolution based on resource type
  if (resource === 'exams') {
    try {
      const examsTable = await table<{ id: string }>('exams');
      await examsTable.put(resolved as unknown as { id: string }, id);
    } catch (e) {
      console.error('Failed to apply resolution:', e);
      throw e;
    }
  }
  // Add other resource handlers as needed
}

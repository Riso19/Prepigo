// Date normalization helpers for local-day semantics without timezone drift.
// We keep storage as ISO string for backward compatibility.

export function isYYYYMMDD(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Returns ISO string representing local midnight for the provided input date.
export function asLocalDayISO(input?: string | Date | null): string | undefined {
  if (!input) return undefined;
  if (typeof input === 'string') {
    if (isYYYYMMDD(input)) {
      const [y, m, d] = input.split('-').map(Number);
      const dt = new Date(y, (m - 1), d, 0, 0, 0, 0);
      return dt.toISOString();
    }
    const parsed = new Date(input);
    if (isNaN(parsed.getTime())) return undefined;
    const y = parsed.getFullYear();
    const m = parsed.getMonth();
    const d = parsed.getDate();
    return new Date(y, m, d, 0, 0, 0, 0).toISOString();
  }
  const y = input.getFullYear();
  const m = input.getMonth();
  const d = input.getDate();
  return new Date(y, m, d, 0, 0, 0, 0).toISOString();
}

// Parse an exam date string into a Date object at local midnight of that day.
export function parseExamDateAsLocal(dateStr: string): Date {
  if (isYYYYMMDD(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, (m - 1), d, 0, 0, 0, 0);
  }
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return new Date();
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
}

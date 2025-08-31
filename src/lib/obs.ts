// Lightweight observability helpers. If Sentry is available, use it; otherwise, no-op with console.

interface SentryBreadcrumb {
  category: string;
  message: string;
  level?: 'debug' | 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}

interface SentryInstance {
  addBreadcrumb?: (breadcrumb: SentryBreadcrumb) => void;
  captureMessage?: (message: string, options: { level: string; extra?: Record<string, unknown> }) => void;
  captureException?: (exception: unknown, options: { extra?: Record<string, unknown> }) => void;
}

export function addBreadcrumb(b: SentryBreadcrumb) {
  // @ts-expect-error - Sentry may not be available
  const Sentry: SentryInstance | undefined = (globalThis as any).Sentry;
  if (Sentry?.addBreadcrumb) {
    Sentry.addBreadcrumb({ ...b });
  } else {
    if (b.level === 'error') console.error('[breadcrumb]', b);
    else console.log('[breadcrumb]', b);
  }
}

export function captureMessage(msg: string, level: 'info' | 'warning' | 'error' = 'info', data?: Record<string, unknown>) {
  // @ts-expect-error - Sentry may not be available
  const Sentry: SentryInstance | undefined = (globalThis as any).Sentry;
  if (Sentry?.captureMessage) {
    Sentry.captureMessage(msg, { level, extra: data });
  } else {
    const fn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
    fn('[obs]', msg, data || {});
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>) {
  // @ts-expect-error - Sentry may not be available
  const Sentry: SentryInstance | undefined = (globalThis as any).Sentry;
  if (Sentry?.captureException) {
    Sentry.captureException(err, { extra: context });
  } else {
    console.error('[obs]', err, context || {});
  }
}
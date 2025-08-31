// Lightweight Sentry initialization gated by env
// Uses @sentry/react if VITE_SENTRY_DSN is present; otherwise no-op

// Avoid import cost when DSN is absent
const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (DSN) {
  import('@sentry/react').then(({ init, browserTracingIntegration }) => {
    init({
      dsn: DSN,
      integrations: [
        browserTracingIntegration(),
      ],
      tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      replaysSessionSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAYS_SAMPLE_RATE ?? 0),
      environment: (import.meta.env.MODE || 'development'),
      release: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? undefined,
    });
  }).catch(() => {
    // ignore if package missing
  });
}

/**
 * Sentry initialization.
 *
 * Activates only when VITE_SENTRY_DSN is set AND the build is production
 * (or VITE_SENTRY_FORCE=1 for staging tests). Otherwise no-op.
 */
import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  const force = import.meta.env.VITE_SENTRY_FORCE === "1";
  if (import.meta.env.DEV && !force) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION as string | undefined,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration({ maskAllText: true })],
    beforeSend(event) {
      // Strip PII fields commonly present in dental/healthcare context
      if (event.request?.cookies) delete event.request.cookies;
      return event;
    },
  });
  initialized = true;
}

export function captureSentry(error: unknown, ctx?: Record<string, any>) {
  if (!initialized) return;
  Sentry.captureException(error, { extra: ctx });
}

export { Sentry };

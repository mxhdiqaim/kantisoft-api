import * as Sentry from "@sentry/node";

Sentry.init({
    dsn: SENTRY_DSN,

    sendDefaultPii: true,
    // tracesSampleRate: 1.0,
});

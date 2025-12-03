import * as Sentry from "@sentry/node";

export const initializeSentry = (SENTRY_DSN: string) => {
    Sentry.init({
        dsn: SENTRY_DSN,
        sendDefaultPii: true,
        tracesSampleRate: 1.0,
    });
};

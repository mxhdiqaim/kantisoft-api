import * as Sentry from "@sentry/node";
import { getEnvVariable } from "../utils";

const SENTRY_DSN = getEnvVariable("SENTRY_DSN");

Sentry.init({
    dsn: SENTRY_DSN,

    sendDefaultPii: true,
    // tracesSampleRate: 1.0,
});

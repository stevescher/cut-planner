import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://66873ba75d0d6f248d69308e55bd3cbb@o4511563150589952.ingest.us.sentry.io/4511574718087168",
  tracesSampleRate: 1,
  debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

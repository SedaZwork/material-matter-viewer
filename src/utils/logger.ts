/**
 * Environment-aware logging utility
 * Only logs to console in development mode to prevent information leakage in production
 */
export const logger = {
  error: (message: string, error?: unknown) => {
    if (import.meta.env.DEV) {
      console.error(message, error);
    }
    // In production, you could send to a monitoring service like Sentry
    // Example: Sentry.captureException(error);
  },
  warn: (message: string, data?: unknown) => {
    if (import.meta.env.DEV) {
      console.warn(message, data);
    }
  },
  info: (message: string, data?: unknown) => {
    if (import.meta.env.DEV) {
      console.info(message, data);
    }
  },
  debug: (message: string, data?: unknown) => {
    if (import.meta.env.DEV) {
      console.log(message, data);
    }
  },
};

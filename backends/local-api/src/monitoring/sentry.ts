import * as Sentry from '@sentry/node';
import type { Express, Request, Response, NextFunction } from 'express';

const SENTRY_DSN = process.env.SENTRY_DSN || '';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

export function initSentry(app: Express) {
  if (!SENTRY_DSN) {
    console.warn('⚠️  SENTRY_DSN not set - error tracking disabled');
    return;
  }
  
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
  });
  
  // Request context middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    Sentry.setContext('request', {
      method: req.method,
      url: req.url,
      headers: req.headers,
    });
    next();
  });
  
  console.log(`✅ Sentry initialized (${ENVIRONMENT})`);
}

export function sentryErrorHandler() {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    Sentry.captureException(err);
    next(err);
  };
}

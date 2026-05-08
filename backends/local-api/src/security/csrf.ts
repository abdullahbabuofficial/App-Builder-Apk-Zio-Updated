import csrf from 'csurf';
import cookieParser from 'cookie-parser';
import type { Express, Request, Response } from 'express';

export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
});

export function setupCsrf(app: Express) {
  app.use(cookieParser());
  
  // Only apply CSRF to specific routes (not to API routes with Bearer tokens)
  // Skip CSRF for /api/events, /sdk/*, /push/*, and /api/webhooks/*
  app.use((req: Request, res: Response, next) => {
    if (
      req.path.startsWith('/api/events') ||
      req.path.startsWith('/sdk/') ||
      req.path.startsWith('/push/') ||
      req.path.startsWith('/api/webhooks/')
    ) {
      return next();
    }
    csrfProtection(req, res, next);
  });
  
  // Endpoint to get CSRF token
  app.get('/api/csrf-token', (req: Request, res: Response) => {
    res.json({ csrfToken: (req as any).csrfToken() });
  });
}

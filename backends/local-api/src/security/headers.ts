import helmet from 'helmet';
import type { Express } from 'express';

export function setupSecurityHeaders(app: Express) {
  const isDev = process.env.NODE_ENV !== 'production';
  
  // In development, allow localhost on any port for frontend connections
  const connectSrcDirective = isDev 
    ? ["'self'", 'http://localhost:*', 'http://127.0.0.1:*', process.env.API_DOMAIN || '']
    : ["'self'", process.env.API_DOMAIN || ''];

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Adjust for prod
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: connectSrcDirective,
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));
}

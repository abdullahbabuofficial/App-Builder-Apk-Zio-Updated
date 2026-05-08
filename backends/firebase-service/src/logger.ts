// firebase-service/src/logger.ts
//
// pino is fast and structured. Default level is info; bump to debug
// for development.

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'apkzio-dispatcher',
    env: process.env.NODE_ENV ?? 'production',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

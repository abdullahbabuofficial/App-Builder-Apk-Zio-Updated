import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
const redis = REDIS_URL ? new Redis(REDIS_URL) : null;

// Create RedisStore if Redis is available
function createRedisStore(prefix: string) {
  if (!redis) return undefined;
  
  // Use sendCommand pattern for rate-limit-redis v4+
  return new (RedisStore as any)({
    sendCommand: async (...args: any[]) => {
      // redis.call expects (command: string, ...args: any[])
      const [command, ...rest] = args;
      return redis.call(command, ...rest);
    },
    prefix,
  });
}

export const apiLimiter = rateLimit({
  store: createRedisStore('rl:api:'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  store: createRedisStore('rl:auth:'),
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later.',
});

export const eventLimiter = rateLimit({
  store: createRedisStore('rl:event:'),
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 events per minute
  message: 'Event ingestion rate limit exceeded.',
});

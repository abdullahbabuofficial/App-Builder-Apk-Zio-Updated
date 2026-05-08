/**
 * Redis Cache Layer for ApkZio
 * 
 * Provides distributed caching across multiple API instances
 * Falls back to in-memory cache if Redis is unavailable
 */

import Redis from 'ioredis';
import { logger } from '../monitoring/logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

class RedisCache {
  private redis: any | null = null; // Using any for Redis instance due to ESM/CJS interop issues
  private connected: boolean = false;
  private fallbackCache = new Map<string, { data: any; expiresAt: number }>();

  constructor() {
    if (REDIS_ENABLED) {
      this.initRedis();
    } else {
      logger.info('Redis caching disabled, using in-memory fallback');
    }
  }

  private initRedis() {
    try {
      // Type cast for ESM/CJS interop
      const RedisClient = Redis as any;
      this.redis = new RedisClient(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            logger.warn('Redis connection failed after 3 retries, using fallback cache');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        reconnectOnError: (err: Error) => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        },
      });

      if (this.redis) {
        this.redis.on('connect', () => {
          this.connected = true;
          logger.info('✅ Redis cache connected');
        });

        this.redis.on('error', (err: Error) => {
          this.connected = false;
          logger.error('Redis connection error:', err);
        });

        this.redis.on('close', () => {
          this.connected = false;
          logger.warn('Redis connection closed');
        });
      }
    } catch (err) {
      logger.error('Failed to initialize Redis:', err);
      this.redis = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    // Try Redis first
    if (this.redis && this.connected) {
      try {
        const value = await this.redis.get(key);
        if (value) {
          return JSON.parse(value) as T;
        }
      } catch (err) {
        logger.error('Redis GET error:', err);
      }
    }

    // Fallback to in-memory cache
    const cached = this.fallbackCache.get(key);
    if (cached) {
      if (Date.now() < cached.expiresAt) {
        return cached.data as T;
      }
      this.fallbackCache.delete(key);
    }

    return null;
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);

    // Try Redis first
    if (this.redis && this.connected) {
      try {
        await this.redis.setex(key, ttlSeconds, serialized);
        return;
      } catch (err) {
        logger.error('Redis SET error:', err);
      }
    }

    // Fallback to in-memory cache
    this.fallbackCache.set(key, {
      data: value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    if (this.redis && this.connected) {
      try {
        await this.redis.del(key);
      } catch (err) {
        logger.error('Redis DEL error:', err);
      }
    }

    this.fallbackCache.delete(key);
  }

  async delPattern(pattern: string): Promise<number> {
    let count = 0;

    // Redis pattern deletion
    if (this.redis && this.connected) {
      try {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          count = await this.redis.del(...keys);
        }
      } catch (err) {
        logger.error('Redis pattern delete error:', err);
      }
    }

    // Fallback pattern deletion
    for (const key of this.fallbackCache.keys()) {
      if (this.matchPattern(key, pattern)) {
        this.fallbackCache.delete(key);
        count++;
      }
    }

    return count;
  }

  async flush(): Promise<void> {
    if (this.redis && this.connected) {
      try {
        await this.redis.flushdb();
      } catch (err) {
        logger.error('Redis FLUSH error:', err);
      }
    }

    this.fallbackCache.clear();
  }

  async ping(): Promise<boolean> {
    if (this.redis && this.connected) {
      try {
        const result = await this.redis.ping();
        return result === 'PONG';
      } catch {
        return false;
      }
    }
    return false;
  }

  getStats() {
    return {
      connected: this.connected,
      fallbackSize: this.fallbackCache.size,
      redisEnabled: REDIS_ENABLED,
    };
  }

  private matchPattern(key: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

// Singleton instance
export const cache = new RedisCache();

/**
 * Cache wrapper for expensive operations
 * Automatically handles caching with TTL
 */
export async function cached<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  // Try to get from cache
  const cached = await cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Execute function and cache result
  const result = await fn();
  await cache.set(key, result, ttl);
  return result;
}

/**
 * Cache with automatic invalidation on error
 * Useful for data that might become stale
 */
export async function cachedWithInvalidation<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>,
  validator?: (data: T) => boolean
): Promise<T> {
  const cached = await cache.get<T>(key);
  
  if (cached !== null) {
    // Validate cached data if validator provided
    if (validator && !validator(cached)) {
      await cache.del(key);
      // Fall through to re-fetch
    } else {
      return cached;
    }
  }

  const result = await fn();
  await cache.set(key, result, ttl);
  return result;
}

// Cleanup fallback cache periodically
setInterval(() => {
  const now = Date.now();
  let removed = 0;
  
  for (const [key, entry] of (cache as any).fallbackCache.entries()) {
    if (now > entry.expiresAt) {
      (cache as any).fallbackCache.delete(key);
      removed++;
    }
  }
  
  if (removed > 0) {
    logger.debug(`Cache cleanup: removed ${removed} expired entries`);
  }
}, 300_000); // Every 5 minutes

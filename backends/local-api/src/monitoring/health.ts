import { pool } from '../db.js';
import { cache } from '../cache/redis-cache.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: { status: string; latency?: number };
    memory: { status: string; usage: number };
    uptime: { status: string; seconds: number };
    redis?: { status: string; connected: boolean };
  };
  timestamp: string;
}

export interface DetailedHealthStatus extends HealthStatus {
  performance: {
    database_pool: {
      total: number;
      idle: number;
      waiting: number;
    };
    memory_detailed: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    cache: {
      connected: boolean;
      fallbackSize: number;
      redisEnabled: boolean;
    };
  };
  version: string;
  environment: string;
}

export async function checkHealth(): Promise<HealthStatus> {
  const checks: HealthStatus['checks'] = {
    database: { status: 'unknown' },
    memory: { status: 'unknown', usage: 0 },
    uptime: { status: 'healthy', seconds: process.uptime() },
  };
  
  // Database check
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const latency = Date.now() - start;
    checks.database = { 
      status: latency < 100 ? 'healthy' : 'degraded', 
      latency 
    };
  } catch (err) {
    checks.database = { status: 'unhealthy' };
  }
  
  // Memory check
  const memUsage = process.memoryUsage();
  const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  checks.memory = {
    status: heapPercent < 80 ? 'healthy' : heapPercent < 95 ? 'degraded' : 'unhealthy',
    usage: Math.round(heapPercent),
  };
  
  // Redis check
  try {
    await cache.ping();
    const stats = cache.getStats();
    checks.redis = {
      status: stats.connected ? 'healthy' : 'degraded',
      connected: stats.connected,
    };
  } catch {
    checks.redis = {
      status: 'degraded',
      connected: false,
    };
  }
  
  // Overall status
  const statuses = Object.values(checks).map(c => c.status);
  const overallStatus: HealthStatus['status'] = 
    statuses.includes('unhealthy') ? 'unhealthy' :
    statuses.includes('degraded') ? 'degraded' : 'healthy';
  
  return {
    status: overallStatus,
    checks,
    timestamp: new Date().toISOString(),
  };
}

export async function checkDetailedHealth(): Promise<DetailedHealthStatus> {
  const basic = await checkHealth();
  const memUsage = process.memoryUsage();
  const cacheStats = cache.getStats();
  
  return {
    ...basic,
    performance: {
      database_pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
      memory_detailed: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
      },
      cache: cacheStats,
    },
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  };
}

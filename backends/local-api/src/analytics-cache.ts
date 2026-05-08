/**
 * Analytics Cache Layer
 * 
 * In-memory cache with TTL for reducing database load on frequently queried data
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class AnalyticsCache {
  private cache = new Map<string, CacheEntry<any>>();
  private hits = 0;
  private misses = 0;
  
  /**
   * Get cached data or null if expired/missing
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    this.hits++;
    return entry.data as T;
  }
  
  /**
   * Set cache entry with TTL in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
  
  /**
   * Delete a specific cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    console.log('🗑️  Analytics cache cleared');
  }
  
  /**
   * Invalidate cache entries matching a pattern
   * Useful for invalidating all cache for a specific app
   */
  invalidatePattern(pattern: string) {
    let count = 0;
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    if (count > 0) {
      console.log(`🗑️  Invalidated ${count} cache entries matching "${pattern}"`);
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total * 100).toFixed(2) : '0.00';
    
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
    };
  }
  
  /**
   * Clean up expired entries (call periodically)
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`🧹 Cache cleanup: removed ${removed} expired entries`);
    }
  }
  
  /**
   * Start automatic cleanup interval
   */
  startCleanup(intervalMs: number = 300_000) { // Default 5 minutes
    setInterval(() => {
      this.cleanup();
    }, intervalMs);
  }
}

// Singleton instance
export const analyticsCache = new AnalyticsCache();

// Start automatic cleanup every 5 minutes
analyticsCache.startCleanup();

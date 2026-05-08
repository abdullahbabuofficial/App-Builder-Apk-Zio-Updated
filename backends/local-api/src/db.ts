import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/apkzio';

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

/**
 * Execute a SQL query with optional parameters
 * Logs slow queries (>1s) for monitoring
 */
export async function query<T extends pg.QueryResultRow = any>(
  text: string, 
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`Slow query (${duration}ms):`, text.slice(0, 100));
    }
    return res;
  } catch (err) {
    console.error('Query error:', err, 'SQL:', text);
    throw err;
  }
}

/**
 * Safe query with SQL injection pattern detection
 * Use for queries that might contain dangerous operations
 */
export async function safeQuery<T extends pg.QueryResultRow = any>(
  text: string, 
  params?: any[]
): Promise<pg.QueryResult<T>> {
  // Check for SQL injection patterns
  const dangerous = /(\bDROP\b|\bDELETE\b|\bTRUNCATE\b)/i;
  if (dangerous.test(text) && !text.includes('--safe')) {
    throw new Error('Potentially dangerous SQL detected');
  }
  
  return query<T>(text, params);
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect();
}

/**
 * Execute a transaction with automatic commit/rollback
 */
export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Close all database connections (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  await pool.end();
}

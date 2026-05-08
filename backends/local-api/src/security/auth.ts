import crypto from 'crypto';
import { query } from '../db.js';
import type { Request, Response, NextFunction } from 'express';

export async function authenticateApiKey(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing API key' });
    return;
  }
  
  const apiKey = authHeader.slice(7);
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
  
  try {
    const { rows } = await query(`
      SELECT * FROM api_keys
      WHERE key_hash = $1 AND is_active = true
    `, [hash]);
    
    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }
    
    const key = rows[0];
    
    // Check expiration
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      res.status(401).json({ error: 'API key expired' });
      return;
    }
    
    // Update last used
    await query(`
      UPDATE api_keys SET last_used_at = NOW() WHERE id = $1
    `, [key.id]);
    
    (req as any).apiKey = key;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Authentication failed' });
  }
}

export function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = (req as any).apiKey;
    if (!apiKey?.scopes?.includes(scope)) {
      res.status(403).json({ error: `Missing required scope: ${scope}` });
      return;
    }
    next();
  };
}

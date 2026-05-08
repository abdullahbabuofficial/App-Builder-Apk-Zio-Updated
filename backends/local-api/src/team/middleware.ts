/**
 * Team Permission Middleware
 * 
 * Provides Express middleware for:
 * - Loading user roles from team_members table
 * - Checking permissions before allowing actions
 */

import type { Request, Response, NextFunction } from 'express';
import { hasPermission, type TeamRole } from './roles.js';
import { getTeamMemberByEmail, updateMemberActivity } from './api.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        full_name: string | null;
        role: TeamRole;
        status: string;
      };
    }
  }
}

/**
 * Middleware to load user role from team_members table
 * Requires x-user-email header (set by auth layer)
 */
export async function loadUserRole(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  const userEmail = req.headers['x-user-email'] as string;
  
  if (!userEmail) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  
  try {
    const member = await getTeamMemberByEmail(userEmail);
    
    if (!member) {
      res.status(403).json({ error: 'Not a team member' });
      return;
    }
    
    // Update last active timestamp (fire and forget)
    updateMemberActivity(userEmail).catch(err => {
      console.error('Failed to update member activity:', err);
    });
    
    req.user = {
      id: member.id,
      email: member.email,
      full_name: member.full_name,
      role: member.role,
      status: member.status,
    };
    
    next();
  } catch (err) {
    console.error('Error loading user role:', err);
    res.status(500).json({ error: 'Failed to load user role' });
  }
}

/**
 * Middleware to require a specific permission
 * Must be used after loadUserRole
 */
export function requirePermission(
  resource: 'apps' | 'campaigns' | 'builds' | 'apiKeys' | 'team' | 'billing', 
  action: string
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    const userRole: TeamRole = req.user.role || 'member';
    
    if (!hasPermission(userRole, resource, action)) {
      res.status(403).json({ 
        error: `Permission denied: ${action} on ${resource}`,
        details: `Your role '${userRole}' does not have permission to ${action} ${resource}`,
      });
      return;
    }
    
    next();
  };
}

/**
 * Optional middleware to load user role without requiring it
 * Useful for endpoints that work differently based on role
 */
export async function optionalUserRole(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  const userEmail = req.headers['x-user-email'] as string;
  
  if (!userEmail) {
    next();
    return;
  }
  
  try {
    const member = await getTeamMemberByEmail(userEmail);
    
    if (member) {
      req.user = {
        id: member.id,
        email: member.email,
        full_name: member.full_name,
        role: member.role,
        status: member.status,
      };
    }
    
    next();
  } catch (err) {
    console.error('Error loading optional user role:', err);
    next();
  }
}

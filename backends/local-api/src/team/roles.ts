/**
 * Team Role Definitions and Permission System
 * 
 * Roles:
 * - owner: Full access to everything
 * - admin: Most permissions except managing roles/billing
 * - developer: Can work on apps, campaigns, builds
 * - analyst: Read-only access to data
 * - member: Basic read-only access
 */

export type TeamRole = 'owner' | 'admin' | 'developer' | 'analyst' | 'member';

export interface RolePermissions {
  apps: ('create' | 'read' | 'update' | 'delete')[];
  campaigns: ('create' | 'read' | 'update' | 'delete' | 'send')[];
  builds: ('create' | 'read' | 'delete')[];
  apiKeys: ('create' | 'read' | 'revoke')[];
  team: ('invite' | 'remove' | 'manage')[];
  billing: ('read' | 'update')[];
}

export const ROLE_PERMISSIONS: Record<TeamRole, RolePermissions> = {
  owner: {
    apps: ['create', 'read', 'update', 'delete'],
    campaigns: ['create', 'read', 'update', 'delete', 'send'],
    builds: ['create', 'read', 'delete'],
    apiKeys: ['create', 'read', 'revoke'],
    team: ['invite', 'remove', 'manage'],
    billing: ['read', 'update'],
  },
  admin: {
    apps: ['create', 'read', 'update', 'delete'],
    campaigns: ['create', 'read', 'update', 'delete', 'send'],
    builds: ['create', 'read', 'delete'],
    apiKeys: ['create', 'read', 'revoke'],
    team: ['invite', 'remove'],
    billing: ['read'],
  },
  developer: {
    apps: ['read', 'update'],
    campaigns: ['create', 'read', 'update'],
    builds: ['create', 'read'],
    apiKeys: ['create', 'read'],
    team: [],
    billing: [],
  },
  analyst: {
    apps: ['read'],
    campaigns: ['read'],
    builds: ['read'],
    apiKeys: [],
    team: [],
    billing: [],
  },
  member: {
    apps: ['read'],
    campaigns: ['read'],
    builds: ['read'],
    apiKeys: [],
    team: [],
    billing: [],
  },
};

/**
 * Check if a role has permission to perform an action on a resource
 */
export function hasPermission(
  role: TeamRole, 
  resource: keyof RolePermissions, 
  action: string
): boolean {
  const permissions = ROLE_PERMISSIONS[role]?.[resource];
  if (!permissions) return false;
  // Type assertion since we're checking string actions against union types
  return (permissions as string[]).includes(action);
}

/**
 * Get human-readable description of a role
 */
export function getRoleDescription(role: TeamRole): string {
  const descriptions: Record<TeamRole, string> = {
    owner: 'Full access to all features and settings',
    admin: 'Manage team, apps, and campaigns',
    developer: 'Build and update apps and campaigns',
    analyst: 'View analytics and reports',
    member: 'Basic read-only access',
  };
  return descriptions[role] || 'Unknown role';
}

/**
 * Validate if a role string is valid
 */
export function isValidRole(role: string): role is TeamRole {
  return ['owner', 'admin', 'developer', 'analyst', 'member'].includes(role);
}

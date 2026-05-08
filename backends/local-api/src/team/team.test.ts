/**
 * Team Management Integration Tests
 * 
 * Run with: npm test team.test.ts
 */

import { describe, it, expect } from 'vitest';
import { hasPermission, isValidRole, getRoleDescription, type TeamRole } from './roles.js';

describe('Team Roles', () => {
  describe('hasPermission', () => {
    it('should allow owner to do everything', () => {
      expect(hasPermission('owner', 'apps', 'create')).toBe(true);
      expect(hasPermission('owner', 'apps', 'delete')).toBe(true);
      expect(hasPermission('owner', 'team', 'manage')).toBe(true);
      expect(hasPermission('owner', 'billing', 'update')).toBe(true);
    });

    it('should allow admin most permissions', () => {
      expect(hasPermission('admin', 'apps', 'create')).toBe(true);
      expect(hasPermission('admin', 'team', 'invite')).toBe(true);
      expect(hasPermission('admin', 'team', 'remove')).toBe(true);
      expect(hasPermission('admin', 'team', 'manage')).toBe(false); // Cannot manage roles
      expect(hasPermission('admin', 'billing', 'update')).toBe(false); // Cannot update billing
    });

    it('should restrict developer permissions', () => {
      expect(hasPermission('developer', 'apps', 'read')).toBe(true);
      expect(hasPermission('developer', 'apps', 'update')).toBe(true);
      expect(hasPermission('developer', 'apps', 'create')).toBe(false);
      expect(hasPermission('developer', 'team', 'invite')).toBe(false);
      expect(hasPermission('developer', 'billing', 'read')).toBe(false);
    });

    it('should restrict analyst to read-only', () => {
      expect(hasPermission('analyst', 'apps', 'read')).toBe(true);
      expect(hasPermission('analyst', 'campaigns', 'read')).toBe(true);
      expect(hasPermission('analyst', 'apps', 'update')).toBe(false);
      expect(hasPermission('analyst', 'campaigns', 'send')).toBe(false);
      expect(hasPermission('analyst', 'team', 'invite')).toBe(false);
    });

    it('should restrict member to basic read access', () => {
      expect(hasPermission('member', 'apps', 'read')).toBe(true);
      expect(hasPermission('member', 'campaigns', 'read')).toBe(true);
      expect(hasPermission('member', 'builds', 'read')).toBe(true);
      expect(hasPermission('member', 'apps', 'update')).toBe(false);
      expect(hasPermission('member', 'apiKeys', 'create')).toBe(false);
      expect(hasPermission('member', 'team', 'invite')).toBe(false);
    });
  });

  describe('isValidRole', () => {
    it('should validate correct roles', () => {
      expect(isValidRole('owner')).toBe(true);
      expect(isValidRole('admin')).toBe(true);
      expect(isValidRole('developer')).toBe(true);
      expect(isValidRole('analyst')).toBe(true);
      expect(isValidRole('member')).toBe(true);
    });

    it('should reject invalid roles', () => {
      expect(isValidRole('superadmin')).toBe(false);
      expect(isValidRole('guest')).toBe(false);
      expect(isValidRole('')).toBe(false);
      expect(isValidRole('OWNER')).toBe(false); // Case sensitive
    });
  });

  describe('getRoleDescription', () => {
    it('should return descriptions for all roles', () => {
      const roles: TeamRole[] = ['owner', 'admin', 'developer', 'analyst', 'member'];
      roles.forEach(role => {
        const desc = getRoleDescription(role);
        expect(desc).toBeTruthy();
        expect(desc.length).toBeGreaterThan(10);
      });
    });
  });
});

describe('Permission Scenarios', () => {
  it('should allow developer to create campaigns but not send them', () => {
    expect(hasPermission('developer', 'campaigns', 'create')).toBe(true);
    expect(hasPermission('developer', 'campaigns', 'read')).toBe(true);
    expect(hasPermission('developer', 'campaigns', 'update')).toBe(true);
    expect(hasPermission('developer', 'campaigns', 'send')).toBe(false);
  });

  it('should allow admin to manage team but not roles', () => {
    expect(hasPermission('admin', 'team', 'invite')).toBe(true);
    expect(hasPermission('admin', 'team', 'remove')).toBe(true);
    expect(hasPermission('admin', 'team', 'manage')).toBe(false); // Cannot change roles
  });

  it('should only allow owner and admin to create API keys', () => {
    expect(hasPermission('owner', 'apiKeys', 'create')).toBe(true);
    expect(hasPermission('admin', 'apiKeys', 'create')).toBe(true);
    expect(hasPermission('developer', 'apiKeys', 'create')).toBe(true);
    expect(hasPermission('analyst', 'apiKeys', 'create')).toBe(false);
    expect(hasPermission('member', 'apiKeys', 'create')).toBe(false);
  });
});

/**
 * Manual API Testing Guide
 * 
 * 1. Start the server:
 *    cd backends/local-api && npm run dev
 * 
 * 2. Invite a team member:
 *    curl -X POST http://localhost:8787/api/team/invite \
 *      -H "Content-Type: application/json" \
 *      -H "x-user-email: admin@example.com" \
 *      -d '{"email":"dev@example.com","role":"developer"}'
 * 
 * 3. List team members:
 *    curl http://localhost:8787/api/team/members \
 *      -H "x-user-email: admin@example.com"
 * 
 * 4. Accept invite (use token from invite response):
 *    curl -X POST http://localhost:8787/api/team/accept \
 *      -H "Content-Type: application/json" \
 *      -d '{"token":"TOKEN_HERE","email":"dev@example.com"}'
 * 
 * 5. Update member role:
 *    curl -X PATCH http://localhost:8787/api/team/members/MEMBER_ID/role \
 *      -H "Content-Type: application/json" \
 *      -H "x-user-email: admin@example.com" \
 *      -d '{"role":"admin"}'
 * 
 * 6. Remove member:
 *    curl -X DELETE http://localhost:8787/api/team/members/MEMBER_ID \
 *      -H "x-user-email: admin@example.com"
 */

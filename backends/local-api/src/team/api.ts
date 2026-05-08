/**
 * Team Management API Functions
 * 
 * Core operations:
 * - Invite team members
 * - Accept invitations
 * - Remove members
 * - Update roles
 * - List members
 */

import { query } from '../db.js';
import crypto from 'crypto';
import { sendEmail } from '../email.js';
import type { TeamRole } from './roles.js';

export interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  role: TeamRole;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  last_active_at: string | null;
  status: 'invited' | 'active' | 'removed';
  inviter_name?: string;
}

/**
 * Invite a new team member
 * Creates an invite token and sends an email
 */
export async function inviteTeamMember(
  inviterEmail: string,
  inviteeEmail: string,
  role: TeamRole
): Promise<{ id: string; inviteToken: string }> {
  // Get inviter
  const { rows: [inviter] } = await query(`
    SELECT id FROM admin_clients WHERE email = $1
  `, [inviterEmail]);
  
  if (!inviter) {
    throw new Error('Inviter not found');
  }
  
  // Check if member already exists
  const { rows: existing } = await query(`
    SELECT id, status FROM team_members WHERE email = $1
  `, [inviteeEmail]);
  
  if (existing.length > 0 && existing[0].status === 'active') {
    throw new Error('User is already a team member');
  }
  
  // Generate invite token
  const inviteToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');
  
  // Create or update team member
  let memberId: string;
  if (existing.length > 0) {
    // Update existing removed member
    const { rows: [member] } = await query(`
      UPDATE team_members 
      SET role = $1, invited_by = $2, invited_at = NOW(), 
          status = 'invited', invite_token = $3, accepted_at = NULL
      WHERE id = $4
      RETURNING id
    `, [role, inviter.id, tokenHash, existing[0].id]);
    memberId = member.id;
  } else {
    // Create new member
    const { rows: [member] } = await query(`
      INSERT INTO team_members (email, role, invited_by, status, invite_token)
      VALUES ($1, $2, $3, 'invited', $4)
      RETURNING id
    `, [inviteeEmail, role, inviter.id, tokenHash]);
    memberId = member.id;
  }
  
  // Send invite email
  const inviteUrl = `${process.env.ADMIN_URL || 'http://localhost:5173'}/accept-invite?token=${inviteToken}`;
  await sendEmail({
    to: inviteeEmail,
    subject: 'You\'ve been invited to join ApkZio',
    body: `
You've been invited to join the ApkZio team.

Click here to accept: ${inviteUrl}

Role: ${role}

This invite link will expire in 7 days.
    `.trim(),
  });
  
  return { id: memberId, inviteToken };
}

/**
 * Accept an invite token
 * Marks the member as active
 */
export async function acceptInvite(token: string, userEmail: string): Promise<TeamMember> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  const { rows } = await query(`
    UPDATE team_members
    SET status = 'active', accepted_at = NOW(), email = $2, last_active_at = NOW()
    WHERE invite_token = $1 AND status = 'invited'
    RETURNING *
  `, [tokenHash, userEmail]);
  
  if (rows.length === 0) {
    throw new Error('Invalid or expired invite token');
  }
  
  return rows[0];
}

/**
 * Remove a team member
 * Marks them as removed (soft delete)
 */
export async function removeTeamMember(memberId: string): Promise<void> {
  const { rowCount } = await query(`
    UPDATE team_members 
    SET status = 'removed' 
    WHERE id = $1 AND status != 'removed'
  `, [memberId]);
  
  if (rowCount === 0) {
    throw new Error('Member not found or already removed');
  }
}

/**
 * Update a member's role
 */
export async function updateMemberRole(memberId: string, newRole: TeamRole): Promise<void> {
  const { rowCount } = await query(`
    UPDATE team_members 
    SET role = $1 
    WHERE id = $2 AND status = 'active'
  `, [newRole, memberId]);
  
  if (rowCount === 0) {
    throw new Error('Member not found or not active');
  }
}

/**
 * List all team members (excluding removed)
 */
export async function listTeamMembers(): Promise<TeamMember[]> {
  const { rows } = await query<TeamMember>(`
    SELECT 
      tm.*,
      ac.full_name as inviter_name
    FROM team_members tm
    LEFT JOIN admin_clients ac ON tm.invited_by = ac.id
    WHERE tm.status != 'removed'
    ORDER BY 
      CASE tm.status 
        WHEN 'active' THEN 1 
        WHEN 'invited' THEN 2 
        ELSE 3 
      END,
      tm.invited_at DESC
  `);
  
  return rows;
}

/**
 * Get a team member by email
 */
export async function getTeamMemberByEmail(email: string): Promise<TeamMember | null> {
  const { rows } = await query<TeamMember>(`
    SELECT * FROM team_members WHERE email = $1 AND status = 'active'
  `, [email]);
  
  return rows[0] || null;
}

/**
 * Update member's last active timestamp
 */
export async function updateMemberActivity(email: string): Promise<void> {
  await query(`
    UPDATE team_members SET last_active_at = NOW() WHERE email = $1
  `, [email]);
}

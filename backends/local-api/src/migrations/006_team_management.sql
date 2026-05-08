-- Team Management Tables
-- Phase 5: Team member invites, roles, and permissions

-- Team Members
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES admin_clients(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'invited',
  invite_token TEXT,
  UNIQUE(email)
);

-- Team Permissions (granular resource-level access)
CREATE TABLE IF NOT EXISTS team_permissions (
  member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  permission TEXT NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(member_id, resource_type, COALESCE(resource_id, '00000000-0000-0000-0000-000000000000'::UUID), permission)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_members_email ON team_members(email);
CREATE INDEX IF NOT EXISTS idx_members_status ON team_members(status);
CREATE INDEX IF NOT EXISTS idx_permissions_member ON team_permissions(member_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON team_permissions(resource_type, resource_id);

-- Function to update last_active_at
CREATE OR REPLACE FUNCTION update_team_member_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE team_members SET last_active_at = NOW() WHERE email = NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE team_members IS 'Team members with role-based access control';
COMMENT ON COLUMN team_members.role IS 'Role: owner, admin, developer, analyst, or member';
COMMENT ON COLUMN team_members.status IS 'Status: invited, active, or removed';
COMMENT ON COLUMN team_members.invite_token IS 'Hashed invite token for accepting invitations';

COMMENT ON TABLE team_permissions IS 'Granular resource-level permissions for team members';
COMMENT ON COLUMN team_permissions.resource_type IS 'Resource type: apps, campaigns, builds, apiKeys, team, billing';
COMMENT ON COLUMN team_permissions.resource_id IS 'Specific resource ID, or NULL for global permission';
COMMENT ON COLUMN team_permissions.permission IS 'Permission: create, read, update, delete, send, revoke, invite, remove, manage';

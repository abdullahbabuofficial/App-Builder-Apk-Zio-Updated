# Team Management API

Complete team management system with role-based access control (RBAC).

## Features

- ✅ Invite team members via email
- ✅ Role-based permissions (Owner, Admin, Developer, Analyst, Member)
- ✅ Accept invitations with secure tokens
- ✅ Remove team members
- ✅ Update member roles
- ✅ Track member activity

## Database Schema

### team_members
```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES admin_clients(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'invited',
  invite_token TEXT
);
```

### team_permissions
```sql
CREATE TABLE team_permissions (
  member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  permission TEXT NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(member_id, resource_type, resource_id, permission)
);
```

## Roles and Permissions

### Owner
- Full access to all features
- Can manage billing
- Can manage team roles
- Can invite/remove members

### Admin
- Can manage team
- Can invite/remove members
- Full CRUD on apps, campaigns, builds
- Cannot manage billing or owner roles

### Developer
- Can create and update apps/campaigns
- Can create builds and API keys
- Read access to most resources

### Analyst
- Read-only access to analytics
- Can view apps, campaigns, builds

### Member
- Basic read-only access

## API Endpoints

### POST /api/team/invite
Invite a new team member.

**Auth**: Requires `team:invite` permission

**Request**:
```json
{
  "email": "colleague@company.com",
  "role": "developer"
}
```

**Response**:
```json
{
  "ok": true,
  "id": "uuid",
  "inviteToken": "token"
}
```

### POST /api/team/accept
Accept an invitation (public endpoint).

**Auth**: None required

**Request**:
```json
{
  "token": "invite-token",
  "email": "colleague@company.com"
}
```

**Response**:
```json
{
  "ok": true,
  "member": { ... }
}
```

### GET /api/team/members
List all team members.

**Auth**: Requires `team:invite` permission

**Response**:
```json
{
  "ok": true,
  "members": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "role": "developer",
      "status": "active",
      "invited_at": "2026-01-01T00:00:00Z",
      "accepted_at": "2026-01-01T01:00:00Z",
      "last_active_at": "2026-05-08T16:00:00Z"
    }
  ]
}
```

### DELETE /api/team/members/:id
Remove a team member.

**Auth**: Requires `team:remove` permission

**Response**:
```json
{
  "ok": true
}
```

### PATCH /api/team/members/:id/role
Update a member's role.

**Auth**: Requires `team:manage` permission

**Request**:
```json
{
  "role": "admin"
}
```

**Response**:
```json
{
  "ok": true
}
```

## Usage Example

```typescript
import { 
  inviteTeamMember, 
  listTeamMembers, 
  updateMemberRole 
} from './team/api.js';
import { hasPermission } from './team/roles.js';

// Invite a member
const result = await inviteTeamMember(
  'owner@company.com',
  'dev@company.com',
  'developer'
);

// Check permission
if (hasPermission('developer', 'apps', 'create')) {
  // Allow app creation
}

// List members
const members = await listTeamMembers();

// Update role
await updateMemberRole(memberId, 'admin');
```

## Frontend Integration

The Settings page (`apkzio-admin/src/pages/Settings.tsx`) includes a complete team management UI:

- Team members table with roles and status
- Invite modal with role selection
- Role update dropdown
- Remove member action
- Role permissions reference card

## Security

- Invite tokens are hashed using SHA-256
- Tokens are single-use and expire
- All team routes require authentication via `x-user-email` header
- Permission checks happen on every protected endpoint
- Last activity is tracked for auditing

## Email Service

Currently uses a stub that logs to console. To integrate a real email service:

1. Install email provider SDK (SendGrid, Mailgun, or Resend)
2. Update `src/email.ts` with provider credentials
3. Uncomment integration code in `sendEmail()` function

## Migration

Run migration 006:
```bash
cd backends/local-api
npm run migrate
```

## TODO

- [ ] Add email provider integration
- [ ] Add invite expiration (7 days)
- [ ] Add invite resend functionality
- [ ] Add bulk invite support
- [ ] Add team activity audit log
- [ ] Add SSO integration
- [ ] Add custom role creation

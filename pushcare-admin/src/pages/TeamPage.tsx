import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/lib/icons";
import { relTime } from "@/lib/format";
import {
  fetchInvites,
  fetchMembers,
  inviteMember,
  inviteUrl,
  removeMember,
  updateMemberRole,
  type Invite,
  type Member,
  type MemberRole,
} from "@/lib/team";

const ROLE_OPTIONS: Array<{ value: MemberRole; label: string }> = [
  { value: "owner",     label: "Owner" },
  { value: "admin",     label: "Admin" },
  { value: "developer", label: "Developer" },
  { value: "viewer",    label: "Viewer" },
];

function glyphFor(m: Member): string {
  return (m.display_name ?? m.email).slice(0, 1).toUpperCase();
}

export function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("developer");
  const [busy, setBusy] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [m, inv] = await Promise.all([fetchMembers(), fetchInvites()]);
      setMembers(m);
      setInvites(inv);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load team");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }

  async function handleInvite() {
    setBusy(true);
    setErr(null);
    try {
      const inv = await inviteMember(inviteEmail, inviteRole);
      setInvites((prev) => [inv, ...prev]);
      setLastInviteUrl(inviteUrl(inv.token));
      setInviteEmail("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not invite");
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(id: string, role: MemberRole) {
    try {
      const next = await updateMemberRole(id, role);
      setMembers((prev) => prev.map((m) => (m.id === id ? next : m)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update role");
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeMember(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not remove member");
    }
  }

  const counts = useMemo(
    () => ({
      members: members.length,
      pending: invites.length,
    }),
    [members, invites],
  );

  return (
    <>
      <PageHeader
        title="Team"
        description="Members, invites, and per-seat roles for this workspace."
        actions={
          <Button variant="primary" leading={<Icon.Plus size={14} />} onClick={() => {
            setLastInviteUrl(null);
            setInviteOpen(true);
          }}>
            Invite member
          </Button>
        }
      />

      {err && (
        <div className="mb-6 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
          {err}
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Members"
            description={`${counts.members} ${counts.members === 1 ? "person" : "people"} have access to this workspace.`}
          />
          <CardBody padded={false}>
            {loading && members.length === 0 ? (
              <div className="px-5 py-8 text-center font-mono text-[11px] text-bone-low">Loading members…</div>
            ) : members.length === 0 ? (
              <div className="px-5 py-8 text-center text-[13px] text-bone-mid">
                No teammates yet — invite someone to collaborate.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-line-1 text-bone-low">
                      <th className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Member</th>
                      <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Role</th>
                      <th className="hidden px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em] md:table-cell">Last active</th>
                      <th className="px-5 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="border-b border-line-1/70 last:border-b-0 hover:bg-ink-2/60">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar glyph={glyphFor(m)} size={32} />
                            <div>
                              <div className="font-medium text-bone">{m.display_name ?? m.email.split("@")[0]}</div>
                              <div className="font-mono text-[11px] text-bone-low">{m.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={m.role}
                            onChange={(e) => void handleRoleChange(m.id, e.target.value as MemberRole)}
                            options={ROLE_OPTIONS}
                            className="w-40"
                            disabled={m.role === "owner"}
                          />
                        </td>
                        <td className="hidden px-4 py-3 text-bone-mid md:table-cell">
                          {m.last_active_at ? relTime(m.last_active_at) : "—"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {m.role !== "owner" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              leading={<Icon.Trash size={12} />}
                              onClick={() => void handleRemove(m.id)}
                            >
                              Remove
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Pending invites"
            description={`${counts.pending} ${counts.pending === 1 ? "invite" : "invites"} waiting to be accepted.`}
          />
          <CardBody padded={false}>
            {invites.length === 0 ? (
              <div className="px-5 py-8 text-center text-[13px] text-bone-mid">No pending invites.</div>
            ) : (
              <ul>
                {invites.map((inv) => {
                  const url = inviteUrl(inv.token);
                  return (
                    <li
                      key={inv.id}
                      className="flex items-start gap-4 border-b border-line-1/70 px-5 py-4 last:border-b-0"
                    >
                      <div className="grid h-9 w-9 place-items-center rounded-md border border-line-1 bg-ink-2 text-bone-mid">
                        <Icon.Bell size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[13px]">
                          <span className="font-medium text-bone">{inv.email}</span>
                          <Badge tone="info">{inv.role}</Badge>
                          <span className="font-mono text-[10px] text-bone-low">expires {relTime(inv.expires_at)}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <code className="flex-1 select-all overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-line-1 bg-ink-0 px-2 py-1 font-mono text-[11px] text-bone-mid">
                            {url}
                          </code>
                          <Button
                            variant="secondary"
                            size="sm"
                            leading={<Icon.Copy size={12} />}
                            onClick={() => void copyText(url, inv.id)}
                          >
                            {copied === inv.id ? "Copied" : "Copy"}
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a teammate"
        description="They'll receive a link to accept and join this workspace."
        footer={
          lastInviteUrl ? (
            <>
              <Button variant="ghost" onClick={() => { setInviteOpen(false); setLastInviteUrl(null); }}>
                Done
              </Button>
              <Button
                variant="primary"
                leading={<Icon.Copy size={13} />}
                onClick={() => void copyText(lastInviteUrl, "modal")}
              >
                {copied === "modal" ? "Copied" : "Copy invite link"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => void handleInvite()}
                disabled={busy || !inviteEmail.trim()}
              >
                {busy ? "Sending…" : "Send invite"}
              </Button>
            </>
          )
        }
      >
        {lastInviteUrl ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-ok/30 bg-ok/10 p-3 text-[12.5px] text-ok">
              Invite created. Share this link with your teammate:
            </div>
            <code className="block select-all overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-line-1 bg-ink-0 px-3 py-2 font-mono text-[12px] text-bone">
              {lastInviteUrl}
            </code>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Email address" required>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
              />
            </Field>
            <Field label="Role">
              <Select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                options={ROLE_OPTIONS.filter((o) => o.value !== "owner")}
              />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}

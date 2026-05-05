import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Misc";
import { Icon } from "@/lib/icons";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured, supabaseBrowser } from "@/lib/supabase/client";
import { relTime } from "@/lib/format";

const MOCK_SESSIONS = [
  { id: "1", device: "Chrome on macOS · Sequoia", ip: "203.0.113.42", current: true,  lastActive: new Date(Date.now() - 60_000).toISOString() },
  { id: "2", device: "Safari on iOS 18",          ip: "198.51.100.7", current: false, lastActive: new Date(Date.now() - 3600_000 * 5).toISOString() },
  { id: "3", device: "CLI · pushcare-cli/1.4",     ip: "192.0.2.51",   current: false, lastActive: new Date(Date.now() - 86_400_000 * 2).toISOString() },
];

export function Account() {
  const { session, signOut } = useAuth();
  const [name, setName] = useState(
    (session?.user?.user_metadata?.display_name as string | undefined) ?? "",
  );
  const [email] = useState(session?.user?.email ?? "demo@pushcare.io");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdErr, setPwdErr] = useState<string | null>(null);
  const [pwdBusy, setPwdBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileBusy(true);
    try {
      if (isSupabaseConfigured && supabaseBrowser) {
        const { error } = await supabaseBrowser.auth.updateUser({
          data: { display_name: name.trim() || null },
        });
        if (error) throw error;
      }
      setProfileMsg("Saved");
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : "Could not save");
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwdErr(null);
    setPwdMsg(null);
    if (!pwd || pwd.length < 12) {
      setPwdErr("Password must be at least 12 characters");
      return;
    }
    if (pwd !== pwd2) {
      setPwdErr("Passwords don't match");
      return;
    }
    setPwdBusy(true);
    try {
      if (isSupabaseConfigured && supabaseBrowser) {
        const { error } = await supabaseBrowser.auth.updateUser({ password: pwd });
        if (error) throw error;
      }
      setPwd("");
      setPwd2("");
      setPwdMsg("Password updated");
    } catch (err) {
      setPwdErr(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setPwdBusy(false);
    }
  }

  async function confirmDelete() {
    // TODO: Lane 7 — wire to a real account-delete endpoint that revokes JWTs and deletes Auth row.
    try { localStorage.removeItem("pc_signed_in"); } catch { /* ignore */ }
    await signOut();
    setDeleteOpen(false);
  }

  const initial = (name || email).slice(0, 1).toUpperCase();

  return (
    <>
      <PageHeader
        title="Account"
        description="Your profile, password, and active sessions."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Profile" description="Your personal details and account avatar." />
          <CardBody className="space-y-5">
            <div className="flex items-center gap-5">
              <Avatar glyph={initial} size={64} className="text-xl" />
              <div>
                <Button variant="secondary" size="sm">Change avatar</Button>
                <p className="mt-1 text-[11px] text-bone-low">JPG, PNG, or SVG. Max 2 MB.</p>
              </div>
            </div>
            <form onSubmit={(e) => void saveProfile(e)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Display name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
              </Field>
              <Field label="Email" hint="Email is managed by your auth provider.">
                <Input value={email} readOnly className="cursor-not-allowed opacity-70" />
              </Field>
              {profileMsg && (
                <div className="sm:col-span-2 rounded-lg border border-line-1 bg-ink-2/40 px-3 py-2 text-[12px] text-bone-mid">
                  {profileMsg}
                </div>
              )}
            </form>
          </CardBody>
          <CardFooter>
            <span />
            <Button variant="primary" disabled={profileBusy} onClick={(e) => void saveProfile(e as unknown as FormEvent)}>
              {profileBusy ? "Saving…" : "Save changes"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader title="Password" description="Change your password. We'll sign out all other sessions." />
          <CardBody className="space-y-4">
            <form onSubmit={(e) => void changePassword(e)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="New password" required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder="At least 12 characters"
                />
              </Field>
              <Field label="Confirm new password" required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={pwd2}
                  onChange={(e) => setPwd2(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </Field>
              {pwdErr && (
                <div className="sm:col-span-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
                  {pwdErr}
                </div>
              )}
              {pwdMsg && (
                <div className="sm:col-span-2 rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-[13px] text-ok">
                  {pwdMsg}
                </div>
              )}
            </form>
          </CardBody>
          <CardFooter>
            <span />
            <Button
              variant="secondary"
              onClick={(e) => void changePassword(e as unknown as FormEvent)}
              disabled={pwdBusy}
            >
              {pwdBusy ? "Updating…" : "Update password"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader title="Active sessions" description="Devices currently signed into your account." />
          <CardBody padded={false}>
            <ul>
              {MOCK_SESSIONS.map((s) => (
                <li key={s.id} className="flex items-start gap-4 border-b border-line-1/70 px-5 py-4 last:border-b-0">
                  <div className="grid h-9 w-9 place-items-center rounded-md border border-line-1 bg-ink-2 text-bone-mid">
                    <Icon.Phone size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-bone">
                      {s.device}
                      {s.current && (
                        <span className="rounded-full bg-signal/15 px-1.5 py-0.5 font-mono text-[10px] text-signal">
                          this device
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-bone-low">
                      {s.ip} · last active {relTime(s.lastActive)}
                    </div>
                  </div>
                  {!s.current && (
                    <Button variant="ghost" size="sm">Revoke</Button>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Danger zone" />
          <CardBody>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-danger/30 bg-danger/5 p-4">
              <div>
                <div className="text-[13px] font-medium text-bone">Delete account</div>
                <div className="text-[12px] text-bone-mid">
                  Permanently remove your account, apps, and analytics history. This cannot be undone.
                </div>
              </div>
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>Delete account</Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your account?"
        description="This permanently deletes all apps, devices, campaigns, and analytics owned by this workspace."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={deleteText !== "DELETE"}
              onClick={() => void confirmDelete()}
            >
              Permanently delete
            </Button>
          </>
        }
      >
        <Field label='Type "DELETE" to confirm' required>
          <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="DELETE" />
        </Field>
      </Modal>
    </>
  );
}

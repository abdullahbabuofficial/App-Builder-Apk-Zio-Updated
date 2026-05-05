import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/icons";
import { useAuth } from "@/context/AuthContext";
import { acceptInvite } from "@/lib/team";

type State = "idle" | "accepting" | "success" | "error";

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { signedIn, ready } = useAuth();

  const [state, setState] = useState<State>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !signedIn || !token) return;
    setState("accepting");
    void acceptInvite(token)
      .then(() => {
        setState("success");
        setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
      })
      .catch((e) => {
        setState("error");
        setErrMsg(e instanceof Error ? e.message : "Could not accept invite");
      });
  }, [ready, signedIn, token, navigate]);

  if (!token) {
    return (
      <Shell>
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-bone">Missing invite token</h1>
        <p className="mt-3 text-[14px] text-bone-mid">
          The link is incomplete. Ask your teammate to send the full invite URL.
        </p>
        <Link to="/">
          <Button variant="secondary" className="mt-6">Back home</Button>
        </Link>
      </Shell>
    );
  }

  if (!ready) {
    return (
      <Shell>
        <p className="font-mono text-[12px] text-bone-mid">Checking your session…</p>
      </Shell>
    );
  }

  if (!signedIn) {
    const signupHref = `/signup?next=${encodeURIComponent(`/accept-invite?token=${token}`)}`;
    const signinHref = `/sign-in?next=${encodeURIComponent(`/accept-invite?token=${token}`)}`;
    return (
      <Shell>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone-low">Team invitation</div>
        <h1 className="mt-2 font-display text-[34px] font-semibold tracking-tight text-bone">
          You've been invited to a workspace
        </h1>
        <p className="mt-3 text-[14px] text-bone-mid">
          Sign in or create an account to accept this invitation. After authenticating you'll land back here to finish.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to={signinHref}>
            <Button variant="primary" trailing={<Icon.ArrowRight size={14} />}>Sign in</Button>
          </Link>
          <Link to={signupHref}>
            <Button variant="outline">Create account</Button>
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {state === "accepting" && (
        <>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone-low">Accepting invite…</div>
          <h1 className="mt-2 font-display text-[28px] font-semibold tracking-tight text-bone">One moment</h1>
        </>
      )}
      {state === "success" && (
        <>
          <div className="grid h-12 w-12 place-items-center rounded-md border border-signal/30 bg-signal/15 text-signal">
            <Icon.Check size={20} />
          </div>
          <h1 className="mt-4 font-display text-[28px] font-semibold tracking-tight text-bone">
            You're in.
          </h1>
          <p className="mt-2 text-[14px] text-bone-mid">Redirecting you to the dashboard…</p>
        </>
      )}
      {state === "error" && (
        <>
          <div className="grid h-12 w-12 place-items-center rounded-md border border-danger/40 bg-danger/10 text-danger">
            <Icon.Alert size={20} />
          </div>
          <h1 className="mt-4 font-display text-[24px] font-semibold tracking-tight text-bone">
            Could not accept invite
          </h1>
          <p className="mt-2 text-[13px] text-bone-mid">{errMsg ?? "The invite may have expired or been revoked."}</p>
          <Link to="/dashboard">
            <Button variant="secondary" className="mt-6">Go to dashboard</Button>
          </Link>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-0 px-6 py-10 text-bone">
      <div className="w-full max-w-md rounded-2xl border border-line-1 bg-ink-1 p-8 shadow-panel">
        <Link to="/" className="mb-8 flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-signal text-ink-0">
            <Icon.Logo size={18} />
          </div>
          <span className="font-display text-[17px] font-semibold tracking-tight">PushCare</span>
        </Link>
        {children}
      </div>
    </div>
  );
}

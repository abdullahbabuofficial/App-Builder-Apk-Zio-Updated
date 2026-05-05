import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/Button";
import { Card, CardTitle } from "@/components/Card";
import { CategoryToggle } from "@/components/CategoryToggle";
import { ConfirmModal } from "@/components/ConfirmModal";
import { PauseControl } from "@/components/PauseControl";
import {
  CATEGORY_KEYS,
  type CategoryKey,
  type PauseDuration,
  type PreferencesPayload,
  deleteSubscriber,
  fetchPreferences,
  pausePreferences,
  setCategories,
} from "@/lib/api";
import { Icon } from "@/lib/icons";
import { decodeToken, isTokenExpired } from "@/lib/token";

const CATEGORY_COPY: Record<CategoryKey, { label: string; description: string }> = {
  promo: {
    label: "Promotional",
    description: "Sales, deals, and marketing — the kind of pushes you can usually live without.",
  },
  alerts: {
    label: "Alerts",
    description: "Important time-sensitive notices like service outages or breaking news.",
  },
  transactional: {
    label: "Transactional",
    description: "Order confirmations, receipts, and account activity. Usually worth keeping on.",
  },
  news: {
    label: "News & updates",
    description: "Product news, blog posts, and feature announcements.",
  },
};

export function Preferences() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const decoded = useMemo(() => (token ? decodeToken(token) : null), [token]);
  const expired = useMemo(() => (decoded ? isTokenExpired(decoded) : false), [decoded]);

  // Hooks must run unconditionally — keep them above any early returns.
  const navigate = useNavigate();
  const [data, setData] = useState<PreferencesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [pause, setPause] = useState<PauseDuration>("off");
  const [cats, setCats] = useState<Record<CategoryKey, boolean>>({
    promo: false,
    alerts: true,
    transactional: true,
    news: true,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!token || expired) return;
    let alive = true;
    setLoading(true);
    fetchPreferences(token, {
      app_id: decoded?.app_id,
      device_id: decoded?.device_id,
    }).then((p) => {
      if (!alive) return;
      setData(p);
      setPause(p.pause.state);
      setCats(p.categories);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [token, expired, decoded?.app_id, decoded?.device_id]);

  if (!token) return <Navigate to="/" replace />;
  if (expired) {
    return (
      <Navigate
        to="/preferences/error?code=expired&message=This%20link%20has%20expired%2C%20please%20open%20a%20fresh%20one%20from%20the%20app."
        replace
      />
    );
  }
  if (!decoded) {
    return (
      <Navigate
        to="/preferences/error?code=invalid&message=That%20link%20doesn%27t%20look%20right%20%E2%80%94%20please%20reopen%20it%20from%20the%20app."
        replace
      />
    );
  }

  function handlePause(next: PauseDuration) {
    if (!data) return;
    setPause(next); // optimistic
    pausePreferences(token, next);
    if (next !== "off") {
      navigate(`/preferences/paused?duration=${next}`);
    }
  }

  function handleCategory(key: CategoryKey, value: boolean) {
    const next = { ...cats, [key]: value };
    setCats(next);
    const enabled = CATEGORY_KEYS.filter((k) => next[k]);
    setCategories(token, enabled);
  }

  function handleDelete() {
    deleteSubscriber(token);
    navigate("/preferences/deleted", { replace: true });
  }

  const skeleton = loading || !data;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-signal text-ink-0">
          <Icon.Logo size={16} />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-bone-low">
          PushCare
        </span>
      </header>

      <Card>
        {skeleton ? (
          <div className="flex animate-pulse items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-ink-3" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-ink-3" />
              <div className="h-3 w-1/2 rounded bg-ink-3" />
              <div className="h-3 w-1/3 rounded bg-ink-3" />
            </div>
          </div>
        ) : (
          <AppHeader
            appName={data.app.name}
            appPackage={data.app.package}
            iconColor={data.app.icon_color}
            iconGlyph={data.app.icon_glyph}
            subscribedAt={data.device.subscribed_at}
          />
        )}
      </Card>

      <Card>
        <CardTitle
          title="Pause notifications"
          description="Take a break without unsubscribing. Your preferences will resume automatically when the timer ends."
        />
        <PauseControl value={pause} onChange={handlePause} disabled={skeleton} />
      </Card>

      <Card>
        <CardTitle
          title="Categories"
          description="Pick the kinds of notifications you actually want to see."
        />
        <div className="-mx-3 divide-y divide-line-1">
          {CATEGORY_KEYS.map((key) => (
            <CategoryToggle
              key={key}
              label={CATEGORY_COPY[key].label}
              description={CATEGORY_COPY[key].description}
              checked={cats[key]}
              onChange={(v) => handleCategory(key, v)}
              disabled={skeleton}
            />
          ))}
        </div>
      </Card>

      <Card tone="danger">
        <CardTitle
          title="Delete my data"
          description="Removes this device from the app's records. You won't get any more notifications and your preferences will be erased. This can't be undone."
        />
        <Button
          variant="danger"
          fullWidth
          leading={<Icon.Trash size={16} />}
          onClick={() => setConfirmDelete(true)}
          disabled={skeleton}
        >
          Delete my data
        </Button>
      </Card>

      <footer className="pt-2 text-center text-[11px] text-bone-low">
        Powered by{" "}
        <span className="font-medium text-bone-mid">PushCare</span>
        {" · "}
        <a
          /* TODO: replace with the operator's real privacy URL — usually
             passed in via the JWT or a build-time env var. */
          href="#privacy"
          className="hover:text-bone-mid hover:underline"
        >
          Privacy
        </a>
      </footer>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        destructive
        title="Delete your data?"
        description="We'll remove this device from the app's records. You won't be able to undo this from this page."
        confirmLabel="Yes, delete"
      />
    </div>
  );
}

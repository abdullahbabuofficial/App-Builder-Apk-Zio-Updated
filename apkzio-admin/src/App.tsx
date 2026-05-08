import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/layout/Layout";

const SignIn = lazy(() =>
  import("@/pages/SignIn").then((m) => ({ default: m.SignIn })),
);
const Dashboard = lazy(() =>
  import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Apps = lazy(() => import("@/pages/Apps").then((m) => ({ default: m.Apps })));
const AppDetail = lazy(() =>
  import("@/pages/AppDetail").then((m) => ({ default: m.AppDetail })),
);
const Devices = lazy(() =>
  import("@/pages/Devices").then((m) => ({ default: m.Devices })),
);
const Subscribers = lazy(() =>
  import("@/pages/Subscribers").then((m) => ({ default: m.Subscribers })),
);
const Campaigns = lazy(() =>
  import("@/pages/Campaigns").then((m) => ({ default: m.Campaigns })),
);
const NewCampaign = lazy(() =>
  import("@/pages/NewCampaign").then((m) => ({ default: m.NewCampaign })),
);
const CampaignDetail = lazy(() =>
  import("@/pages/CampaignDetail").then((m) => ({ default: m.CampaignDetail })),
);
const Analytics = lazy(() =>
  import("@/pages/Analytics").then((m) => ({ default: m.Analytics })),
);
const ApkBuilder = lazy(() =>
  import("@/pages/ApkBuilder").then((m) => ({ default: m.ApkBuilder })),
);
const ApiKeys = lazy(() =>
  import("@/pages/ApiKeys").then((m) => ({ default: m.ApiKeys })),
);
const Settings = lazy(() =>
  import("@/pages/Settings").then((m) => ({ default: m.Settings })),
);
const Clients = lazy(() =>
  import("@/pages/Clients").then((m) => ({ default: m.Clients })),
);
const ClientDetail = lazy(() =>
  import("@/pages/ClientDetail").then((m) => ({ default: m.ClientDetail })),
);
const Plugins = lazy(() =>
  import("@/pages/Plugins").then((m) => ({ default: m.Plugins })),
);
const PluginDetail = lazy(() =>
  import("@/pages/PluginDetail").then((m) => ({ default: m.PluginDetail })),
);

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-0 font-mono text-[13px] text-bone-mid">
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:userId" element={<ClientDetail />} />
          <Route path="/apps" element={<Apps />} />
          <Route path="/apps/:appId" element={<AppDetail />} />
          <Route path="/apps/:appId/devices" element={<Devices />} />
          <Route path="/apps/:appId/subscribers" element={<Subscribers />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/new" element={<NewCampaign />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/plugins" element={<Plugins />} />
          <Route path="/plugins/:pluginId" element={<PluginDetail />} />
          <Route path="/builder" element={<ApkBuilder />} />
          <Route path="/keys" element={<ApiKeys />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const { signedIn, ready } = useAuth();
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-0 font-mono text-[13px] text-bone-mid">
        Loading session…
      </div>
    );
  }
  if (!signedIn) return <Navigate to="/sign-in" replace state={{ from: loc }} />;
  return <>{children}</>;
}

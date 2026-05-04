import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { SignIn } from "@/pages/SignIn";
import { Dashboard } from "@/pages/Dashboard";
import { Apps } from "@/pages/Apps";
import { AppDetail } from "@/pages/AppDetail";
import { Devices } from "@/pages/Devices";
import { Subscribers } from "@/pages/Subscribers";
import { Campaigns } from "@/pages/Campaigns";
import { NewCampaign } from "@/pages/NewCampaign";
import { CampaignDetail } from "@/pages/CampaignDetail";
import { Analytics } from "@/pages/Analytics";
import { ApkBuilder } from "@/pages/ApkBuilder";
import { ApiKeys } from "@/pages/ApiKeys";
import { Settings } from "@/pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/apps" element={<Apps />} />
        <Route path="/apps/:appId" element={<AppDetail />} />
        <Route path="/apps/:appId/devices" element={<Devices />} />
        <Route path="/apps/:appId/subscribers" element={<Subscribers />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/new" element={<NewCampaign />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/builder" element={<ApkBuilder />} />
        <Route path="/keys" element={<ApiKeys />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
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

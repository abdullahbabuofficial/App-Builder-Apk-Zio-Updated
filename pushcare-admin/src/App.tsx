import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { SignIn } from "@/pages/SignIn";
import { SignUp } from "@/pages/SignUp";
import { Landing } from "@/pages/Landing";
import { Pricing } from "@/pages/Pricing";
import { LegalTerms } from "@/pages/LegalTerms";
import { LegalPrivacy } from "@/pages/LegalPrivacy";
import { AcceptInvitePage } from "@/pages/AcceptInvitePage";
import { Dashboard } from "@/pages/Dashboard";
import { Onboarding } from "@/pages/Onboarding";
import { Account } from "@/pages/Account";
import { Billing } from "@/pages/Billing";
import { TeamPage } from "@/pages/TeamPage";
import { Apps } from "@/pages/Apps";
import { AppDetail } from "@/pages/AppDetail";
import { Devices } from "@/pages/Devices";
import { Subscribers } from "@/pages/Subscribers";
import { Campaigns } from "@/pages/Campaigns";
import { NewCampaign } from "@/pages/NewCampaign";
import { CampaignDetail } from "@/pages/CampaignDetail";
import { Analytics } from "@/pages/Analytics";
import { ApkBuilder } from "@/pages/ApkBuilder";
import { BuildDetail } from "@/pages/BuildDetail";
import { ApiKeys } from "@/pages/ApiKeys";
import { Settings } from "@/pages/Settings";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/sign-in" element={<PublicOnly><SignIn /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><SignUp /></PublicOnly>} />
      <Route path="/legal/terms" element={<LegalTerms />} />
      <Route path="/legal/privacy" element={<LegalPrivacy />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />

      {/* Auth-gated */}
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/account" element={<Account />} />
        <Route path="/account/billing" element={<Billing />} />
        <Route path="/account/team" element={<TeamPage />} />
        <Route path="/apps" element={<Apps />} />
        <Route path="/apps/:appId" element={<AppDetail />} />
        <Route path="/apps/:appId/devices" element={<Devices />} />
        <Route path="/apps/:appId/subscribers" element={<Subscribers />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/new" element={<NewCampaign />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/builder" element={<ApkBuilder />} />
        <Route path="/builder/:id" element={<BuildDetail />} />
        <Route path="/keys" element={<ApiKeys />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
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

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { signedIn, ready } = useAuth();
  if (!ready) return null;
  if (signedIn) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

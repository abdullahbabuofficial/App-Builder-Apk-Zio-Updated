import { useEffect, useMemo, useState } from 'react';
import {
  Smartphone,
  Package,
  Clock,
  CreditCard,
  Calendar,
  ArrowRight,
  AlertCircle,
  TrendingUp,
  Download,
  Plus,
} from 'lucide-react';
import { DashboardLayout } from '../../components/dashboard/dashboard-layout';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Link, navigate } from '../../components/router';
import { useAuth } from '../../contexts/auth-context';
import {
  getApiBaseUrl,
  getMyApps,
  getMyBuilds,
  type App,
  type Build,
  type BuildStatus,
} from '../../lib/api';

function isInflight(status: BuildStatus): boolean {
  return status === 'queued' || status === 'building';
}

function statusBadge(status: BuildStatus) {
  switch (status) {
    case 'success':
      return <Badge className="bg-success text-white">Success</Badge>;
    case 'building':
      return <Badge className="bg-warning text-white">Building</Badge>;
    case 'queued':
      return <Badge className="bg-muted text-foreground">Queued</Badge>;
    case 'failed':
      return <Badge className="bg-destructive text-white">Failed</Badge>;
  }
}

function formatBytes(bytes?: number | null): string {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${mb.toFixed(1)} MB`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export function DashboardOverviewPage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<App[] | null>(null);
  const [builds, setBuilds] = useState<Build[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyApps()
      .then((next) => {
        if (!cancelled) setApps(next);
      })
      .catch(() => {
        if (!cancelled) setApps([]);
      });
    getMyBuilds()
      .then((next) => {
        if (!cancelled) setBuilds(next);
      })
      .catch(() => {
        if (!cancelled) setBuilds([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const greetingName = useMemo(() => {
    const full = user?.full_name?.trim();
    if (!full) return 'there';
    return full.split(' ')[0];
  }, [user]);

  const planLabel = user?.plan
    ? `${user.plan.charAt(0).toUpperCase()}${user.plan.slice(1)} Plan`
    : 'Free Plan';

  const totalApps = apps?.length ?? null;
  const totalBuilds = builds?.length ?? null;
  const successfulBuilds = builds?.filter((b) => b.status === 'success').length ?? null;
  const inflightBuilds = builds?.filter((b) => isInflight(b.status)).length ?? null;

  const stats = [
    {
      icon: Smartphone,
      label: 'Total Apps',
      value: totalApps == null ? null : String(totalApps),
      hint: totalApps === 0 ? 'Create your first app' : 'Across all builds',
    },
    {
      icon: CreditCard,
      label: 'Active Plan',
      value: planLabel,
      hint: user?.email_verified ? 'Email verified' : 'Verify email to unlock features',
    },
    {
      icon: Package,
      label: 'Builds Generated',
      value: totalBuilds == null ? null : String(totalBuilds),
      hint:
        successfulBuilds == null
          ? '—'
          : `${successfulBuilds} successful`,
    },
    {
      icon: Clock,
      label: 'In Progress',
      value: inflightBuilds == null ? null : String(inflightBuilds),
      hint: inflightBuilds && inflightBuilds > 0 ? 'Polling for updates' : 'Nothing in queue',
    },
  ];

  const recentBuilds = useMemo(() => {
    if (!builds) return [];
    return [...builds]
      .sort(
        (a, b) =>
          new Date(b.build_started_at || 0).getTime() -
          new Date(a.build_started_at || 0).getTime(),
      )
      .slice(0, 5);
  }, [builds]);

  return (
    <DashboardLayout currentPage="overview">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            Welcome{greetingName !== 'there' ? `, ${greetingName}` : ' back'}!
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your apps today
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="rounded-2xl bg-card border border-border p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
              {stat.value == null ? (
                <Skeleton className="h-7 w-20 mb-1" />
              ) : (
                <p className="text-2xl font-bold mb-1">{stat.value}</p>
              )}
              <p className="text-xs text-muted-foreground">{stat.hint}</p>
            </div>
          ))}
        </div>

        {/* Email verification reminder */}
        {user && !user.email_verified && (
          <div className="rounded-2xl bg-warning/10 border border-warning/20 p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-warning shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Verify your email</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Confirm {user.email} to unlock builds and protect your account.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/verify-email')}
                >
                  Resend verification
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-border p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4">
              <Smartphone className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-semibold mb-2">Create New App</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Convert your website into an Android app in minutes
            </p>
            <Link to="/dashboard/create-app">
              <Button className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                Start Building
              </Button>
            </Link>
          </div>

          <div className="rounded-2xl bg-card border border-border p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4">
              <TrendingUp className="h-6 w-6 text-accent" />
            </div>
            <h3 className="font-semibold mb-2">Compare Plans</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Find the build limits and features that fit your roadmap.
            </p>
            <Link to="/dashboard/plans">
              <Button variant="outline" className="w-full">
                View Plans
              </Button>
            </Link>
          </div>

          <div className="rounded-2xl bg-card border border-border p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-secondary/20 flex items-center justify-center mb-4">
              <Calendar className="h-6 w-6 text-secondary" />
            </div>
            <h3 className="font-semibold mb-2">Subscription Details</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Manage your subscription and payment methods
            </p>
            <Link to="/dashboard/subscriptions">
              <Button variant="outline" className="w-full">
                Manage
              </Button>
            </Link>
          </div>
        </div>

        {/* Recent Builds */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Recent Builds</h2>
              <Link to="/dashboard/builds">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {builds === null ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recentBuilds.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Package className="h-6 w-6" />
              </div>
              <h3 className="font-semibold mb-2">No builds yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Once you kick off a build it will show up here with status, size and
                download links.
              </p>
              <Link to="/dashboard/create-app">
                <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first app
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Build ID</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">App</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Version</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Size</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBuilds.map((build) => {
                    const href = build.source_zip_url
                      ? `${getApiBaseUrl()}${build.source_zip_url}`
                      : null;
                    return (
                      <tr key={build.id} className="border-b border-border hover:bg-accent/50">
                        <td className="p-4 text-sm font-mono">{build.id.slice(0, 8)}</td>
                        <td className="p-4 text-sm font-medium">{build.app_name}</td>
                        <td className="p-4 text-sm">v{build.version_name}</td>
                        <td className="p-4 text-sm">{statusBadge(build.status)}</td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {formatDate(build.build_started_at)}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {formatBytes(build.size_bytes)}
                        </td>
                        <td className="p-4 text-sm">
                          {href && build.status === 'success' ? (
                            <a href={href} target="_blank" rel="noreferrer" download>
                              <Button size="sm" variant="ghost">
                                <Download className="h-4 w-4" />
                              </Button>
                            </a>
                          ) : (
                            <Button size="sm" variant="ghost" disabled>
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Support Shortcut */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-secondary/5 border border-border p-8 text-center">
          <h3 className="text-xl font-bold mb-2">Need Help?</h3>
          <p className="text-muted-foreground mb-6">
            Email us any time — we read every message and reply on weekdays.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/dashboard/support">
              <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                Open a ticket
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline">Contact us</Button>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

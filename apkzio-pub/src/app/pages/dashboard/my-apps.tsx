import { useEffect, useMemo, useState } from 'react';
import {
  Smartphone,
  Search,
  Filter,
  Plus,
  Globe,
  Calendar,
  Package,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { DashboardLayout } from '../../components/dashboard/dashboard-layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Link } from '../../components/router';
import { getMyApps, type App } from '../../lib/api';

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function statusColor(status?: string | null): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'published' || s === 'active') return 'bg-success text-white';
  if (s === 'building' || s === 'queued') return 'bg-warning text-white';
  if (s === 'failed' || s === 'error') return 'bg-destructive text-white';
  return 'bg-muted text-muted-foreground';
}

const GRADIENTS = [
  'from-primary to-secondary',
  'from-secondary to-accent',
  'from-accent to-primary',
  'from-primary to-accent',
];

export function MyAppsPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [apps, setApps] = useState<App[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const next = await getMyApps();
      setApps(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load apps.');
      setApps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const list = apps ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.package_name.toLowerCase().includes(q) ||
        (a.website_url ?? '').toLowerCase().includes(q),
    );
  }, [apps, search]);

  const isEmpty = !loading && filtered.length === 0;

  return (
    <DashboardLayout currentPage="my-apps">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">My Apps</h1>
            <p className="text-muted-foreground mt-1">Manage all your converted Android applications</p>
          </div>
          <Link to="/dashboard/create-app">
            <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
              <Plus className="mr-2 h-4 w-4" /> Create New App
            </Button>
          </Link>
        </div>

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Couldn't load your apps</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search apps..."
              className="pl-9"
            />
          </div>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />Filter
          </Button>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`px-4 py-2 text-sm ${view === 'grid' ? 'bg-primary text-white' : ''}`}
            >
              Grid
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-4 py-2 text-sm ${view === 'list' ? 'bg-primary text-white' : ''}`}
            >
              List
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Smartphone className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {search ? 'No apps match your search' : 'No apps yet'}
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              {search
                ? 'Try a different name, package or URL — your apps will show here once you create one.'
                : 'Create your first app to convert your website into an installable Android APK.'}
            </p>
            {!search && (
              <Link to="/dashboard/create-app">
                <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first app
                </Button>
              </Link>
            )}
          </div>
        ) : view === 'grid' ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((app, index) => {
              const gradient = GRADIENTS[index % GRADIENTS.length];
              return (
                <div
                  key={app.id}
                  className="group bg-card border border-border rounded-2xl p-6 hover:shadow-xl hover:border-primary/50 transition-all"
                >
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                  >
                    <Smartphone className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <h3 className="font-semibold truncate">{app.name}</h3>
                    {app.status && (
                      <Badge className={statusColor(app.status)}>{app.status}</Badge>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    {app.website_url && (
                      <div className="flex items-center gap-2 truncate">
                        <Globe className="h-4 w-4 shrink-0" />
                        <span className="truncate">{app.website_url}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span className="truncate font-mono text-xs">{app.package_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Created {formatDate(app.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left text-sm">
                  <th className="p-4">App</th>
                  <th className="p-4 hidden md:table-cell">Package</th>
                  <th className="p-4 hidden md:table-cell">Created</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app, index) => {
                  const gradient = GRADIENTS[index % GRADIENTS.length];
                  return (
                    <tr key={app.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}
                          >
                            <Smartphone className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium">{app.name}</p>
                            {app.website_url && (
                              <p className="text-xs text-muted-foreground">{app.website_url}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell text-sm font-mono text-muted-foreground">
                        {app.package_name}
                      </td>
                      <td className="p-4 hidden md:table-cell text-sm text-muted-foreground">
                        {formatDate(app.created_at)}
                      </td>
                      <td className="p-4">
                        {app.status ? (
                          <Badge className={statusColor(app.status)}>{app.status}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
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
    </DashboardLayout>
  );
}

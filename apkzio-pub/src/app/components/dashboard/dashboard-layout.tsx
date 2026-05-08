import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  PlusCircle,
  Smartphone,
  Package,
  CreditCard,
  ShoppingCart,
  Receipt,
  DollarSign,
  FileText,
  User,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  Moon,
  Sun,
  Rocket,
} from 'lucide-react';
import { useTheme } from '../theme-provider';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../ui/command';
import { Link, navigate } from '../router';
import { useAuth } from '../../contexts/auth-context';
import {
  getMyApps,
  getMyBuilds,
  type App,
  type Build,
  type BuildStatus,
} from '../../lib/api';

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}

const BELL_POLL_INTERVAL_MS = 30_000;
const BELL_SEEN_STORAGE_KEY = 'apkzio.bell.seen';
const BELL_SEEN_MAX_ENTRIES = 200;

function buildSeenKey(id: string, status: BuildStatus): string {
  return `${id}|${status}`;
}

function readSeenSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage?.getItem(BELL_SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((entry): entry is string => typeof entry === 'string'));
    }
  } catch {
    // ignore corrupt storage
  }
  return new Set();
}

function writeSeenSet(seen: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    const arr = Array.from(seen);
    const trimmed = arr.length > BELL_SEEN_MAX_ENTRIES ? arr.slice(-BELL_SEEN_MAX_ENTRIES) : arr;
    window.localStorage?.setItem(BELL_SEEN_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota / privacy mode
  }
}

function relativeTime(input?: string | null): string {
  if (!input) return '';
  const t = new Date(input).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 0) return 'just now';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function shortBuildId(id: string): string {
  if (!id) return '';
  const cleaned = id.replace(/^build[-_]?/i, '');
  return cleaned.slice(0, 7);
}

export function DashboardLayout({ children, currentPage = 'overview' }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const [recentBuilds, setRecentBuilds] = useState<Build[] | null>(null);
  const [recentApps, setRecentApps] = useState<App[] | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [seen, setSeen] = useState<Set<string>>(() => readSeenSet());
  const previousStatusRef = useRef<Map<string, BuildStatus>>(new Map());
  const seenHydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getMyApps()
      .then((apps) => {
        if (cancelled) return;
        const sortedApps = [...apps].sort((a, b) => {
          const ta = new Date(a.updated_at || a.created_at || 0).getTime();
          const tb = new Date(b.updated_at || b.created_at || 0).getTime();
          return tb - ta;
        });
        setRecentApps(sortedApps.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setRecentApps([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const applyBuildsSnapshot = useCallback((builds: Build[], shouldToast: boolean) => {
    const sortedBuilds = [...builds].sort((a, b) => {
      const ta = new Date(a.build_started_at || 0).getTime();
      const tb = new Date(b.build_started_at || 0).getTime();
      return tb - ta;
    });
    const previous = previousStatusRef.current;
    const nextStatusMap = new Map<string, BuildStatus>();
    let toastsFired = 0;
    let seenChanged = false;

    setSeen((prev) => {
      const draft = new Set(prev);
      for (const b of sortedBuilds) {
        nextStatusMap.set(b.id, b.status);
        const prior = previous.get(b.id);
        const isTerminal = b.status === 'success' || b.status === 'failed';
        if (
          shouldToast &&
          isTerminal &&
          prior &&
          prior !== b.status &&
          toastsFired < 5
        ) {
          const key = buildSeenKey(b.id, b.status);
          if (!draft.has(key)) {
            const idShort = b.id.slice(0, 8);
            if (b.status === 'success') {
              toast.success(`Build #${idShort} succeeded`);
            } else {
              toast.error(`Build #${idShort} failed`);
            }
            draft.add(key);
            seenChanged = true;
            toastsFired += 1;
          }
        }
      }
      if (seenChanged) writeSeenSet(draft);
      return seenChanged ? draft : prev;
    });

    previousStatusRef.current = nextStatusMap;
    setRecentBuilds(sortedBuilds.slice(0, 5));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setRecentBuilds(null);
      previousStatusRef.current = new Map();
      seenHydratedRef.current = false;
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let firstLoad = !seenHydratedRef.current;

    const tick = async () => {
      try {
        const builds = await getMyBuilds();
        if (cancelled) return;
        applyBuildsSnapshot(builds, !firstLoad);
        if (firstLoad) {
          seenHydratedRef.current = true;
          firstLoad = false;
        }
      } catch {
        if (cancelled) return;
        if (firstLoad) {
          setRecentBuilds([]);
          firstLoad = false;
        }
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(tick, BELL_POLL_INTERVAL_MS);
        }
      }
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [isAuthenticated, user?.id, applyBuildsSnapshot]);

  const filteredBuilds = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    const list = recentBuilds ?? [];
    if (!q) return list;
    return list.filter(
      (b) =>
        b.id.toLowerCase().includes(q) ||
        b.app_name.toLowerCase().includes(q) ||
        b.version_name?.toLowerCase().includes(q),
    );
  }, [recentBuilds, searchValue]);

  const filteredApps = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    const list = recentApps ?? [];
    if (!q) return list;
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.package_name.toLowerCase().includes(q) ||
        (a.website_url ?? '').toLowerCase().includes(q),
    );
  }, [recentApps, searchValue]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchValue('');
  };

  const initial = user?.full_name?.trim()?.[0]?.toUpperCase() ?? '?';
  const planLabel = user?.plan
    ? `${user.plan.charAt(0).toUpperCase()}${user.plan.slice(1)} Plan`
    : 'Free Plan';

  const menuItems = [
    { icon: LayoutDashboard, label: 'Overview', id: 'overview' },
    { icon: PlusCircle, label: 'Create App', id: 'create-app', highlight: true },
    { icon: Smartphone, label: 'My Apps', id: 'my-apps' },
    { icon: Package, label: 'Builds', id: 'builds' },
    { icon: CreditCard, label: 'Plans', id: 'plans' },
    { icon: ShoppingCart, label: 'Cart', id: 'cart' },
    { icon: Receipt, label: 'Checkout', id: 'checkout' },
    { icon: DollarSign, label: 'Subscriptions', id: 'subscriptions' },
    { icon: FileText, label: 'Payments', id: 'payments' },
    { icon: FileText, label: 'Invoices', id: 'invoices' },
    { icon: User, label: 'Profile', id: 'profile' },
    { icon: Settings, label: 'Settings', id: 'settings' },
    { icon: HelpCircle, label: 'Support', id: 'support' },
  ];

  const mobileNav = [
    { icon: LayoutDashboard, label: 'Overview', id: 'overview' },
    { icon: PlusCircle, label: 'Create', id: 'create-app' },
    { icon: Smartphone, label: 'My Apps', id: 'my-apps' },
    { icon: Package, label: 'Builds', id: 'builds' },
    { icon: User, label: 'Profile', id: 'profile' },
  ];

  const hasUnread = (recentBuilds ?? []).some(
    (b) => !seen.has(buildSeenKey(b.id, b.status)),
  );

  const markAllBellSeen = () => {
    const builds = recentBuilds ?? [];
    if (builds.length === 0) return;
    setSeen((prev) => {
      const draft = new Set(prev);
      let changed = false;
      for (const b of builds) {
        const key = buildSeenKey(b.id, b.status);
        if (!draft.has(key)) {
          draft.add(key);
          changed = true;
        }
      }
      if (changed) writeSeenSet(draft);
      return changed ? draft : prev;
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <Link to="/" className="flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" />
            <span className="font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              ApkZio
            </span>
          </Link>

          <div className="flex-1 max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search apps, builds..."
                className="pl-9 h-9 cursor-pointer"
                readOnly
                onFocus={() => setSearchOpen(true)}
                onClick={() => setSearchOpen(true)}
                aria-label="Open quick search"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/dashboard/create-app">
              <Button
                size="sm"
                className="hidden sm:flex bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Create App
              </Button>
            </Link>

            <DropdownMenu
              onOpenChange={(open) => {
                if (open) markAllBellSeen();
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {hasUnread && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Recent build activity</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {recentBuilds === null ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">Loading…</div>
                ) : recentBuilds.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">
                    No build activity yet.
                  </div>
                ) : (
                  recentBuilds.map((build) => (
                    <DropdownMenuItem
                      key={build.id}
                      onSelect={() => navigate(`/dashboard/builds/${build.id}`)}
                      className="flex flex-col items-start gap-0.5"
                    >
                      <span className="text-sm font-medium">
                        Build #{shortBuildId(build.id)} ·{' '}
                        <span className="font-normal text-muted-foreground">
                          {build.status}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {build.app_name} · {relativeTime(build.build_started_at)}
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-semibold">
                {initial}
              </div>
              <Badge className="hidden sm:inline-flex bg-gradient-to-r from-primary to-secondary">
                {planLabel}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 transform border-r border-border bg-card transition-transform lg:translate-x-0 lg:static ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ top: '64px' }}
        >
          <div className="flex flex-col h-full p-4">
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {menuItems.map((item) => (
                <Link
                  key={item.id}
                  to={`/dashboard/${item.id}`}
                  onClick={() => setSidebarOpen(false)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    currentPage === item.id
                      ? 'bg-gradient-to-r from-primary to-secondary text-white'
                      : 'hover:bg-accent'
                  } ${item.highlight && currentPage !== item.id ? 'text-primary' : ''}`}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors text-left w-full"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden"
        aria-label="Primary mobile navigation"
      >
        <ul className="grid grid-cols-5">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <li key={item.id}>
                <Link
                  to={`/dashboard/${item.id}`}
                  className={`flex flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors ${
                    active
                      ? 'text-primary border-t-2 border-primary -mt-px'
                      : 'text-muted-foreground border-t-2 border-transparent -mt-px hover:text-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Quick search dialog */}
      <CommandDialog
        open={searchOpen}
        onOpenChange={(next) => {
          setSearchOpen(next);
          if (!next) setSearchValue('');
        }}
        title="Quick search"
        description="Jump to recent apps and builds"
      >
        <CommandInput
          placeholder="Search apps and builds..."
          value={searchValue}
          onValueChange={setSearchValue}
        />
        <CommandList>
          <CommandEmpty>No matches found.</CommandEmpty>
          {filteredApps.length > 0 && (
            <CommandGroup heading="Apps">
              {filteredApps.map((app) => (
                <CommandItem
                  key={`app-${app.id}`}
                  value={`app ${app.name} ${app.package_name}`}
                  onSelect={() => {
                    closeSearch();
                    navigate('/dashboard/my-apps');
                  }}
                >
                  <Smartphone className="text-primary" />
                  <span className="flex-1 truncate">{app.name}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {app.package_name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {filteredBuilds.length > 0 && filteredApps.length > 0 && <CommandSeparator />}
          {filteredBuilds.length > 0 && (
            <CommandGroup heading="Recent builds">
              {filteredBuilds.map((build) => (
                <CommandItem
                  key={`build-${build.id}`}
                  value={`build ${build.id} ${build.app_name} ${build.version_name}`}
                  onSelect={() => {
                    closeSearch();
                    navigate('/dashboard/builds');
                  }}
                >
                  <Package className="text-primary" />
                  <span className="flex-1 truncate">
                    {build.app_name}{' '}
                    <span className="text-muted-foreground">v{build.version_name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {shortBuildId(build.id)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </div>
  );
}

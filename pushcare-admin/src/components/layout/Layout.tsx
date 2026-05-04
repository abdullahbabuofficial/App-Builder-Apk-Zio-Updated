import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

export function Layout() {
  const { signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const loc = useLocation();

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [loc.pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return (
    <div className="relative min-h-screen text-bone">
      {/* Desktop: fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line-1 bg-ink-1 lg:block">
        <Sidebar onSignOut={() => void signOut()} />
      </aside>

      {/* Mobile: drawer + scrim */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden transition-opacity",
          drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <button
          type="button"
          aria-label="Close menu"
          className="absolute inset-0 bg-ink-0/70 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 w-[280px] border-r border-line-1 bg-ink-1 shadow-modal transition-transform duration-300",
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar onSignOut={() => void signOut()} onClose={() => setDrawerOpen(false)} />
        </aside>
      </div>

      {/* Main column */}
      <div className="lg:pl-[248px]">
        <Topbar onMenu={() => setDrawerOpen(true)} />
        <main className="px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

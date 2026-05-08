import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/lib/icons";
import { copyToClipboard } from "@/lib/utils";
import { useApkzio } from "@/context/ApkzioDataContext";
import { Popover } from "@/components/ui/Popover";
import { useToast } from "@/components/ui/Toast";

type IconKey = keyof typeof Icon;

type LinkRow = {
  label: string;
  href: string;
  icon: IconKey;
  external?: boolean;
};

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3.5 pb-1 pt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">
      {children}
    </div>
  );
}

function RowButton({
  icon,
  label,
  trailing,
  onClick,
  href,
  external,
  asLink,
}: {
  icon: IconKey;
  label: string;
  trailing?: ReactNode;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  asLink?: boolean;
}) {
  const Ic = Icon[icon];
  const inner = (
    <>
      <Ic size={14} className="shrink-0 text-bone-low" />
      <span className="flex-1 truncate text-[13px] text-bone">{label}</span>
      {trailing}
    </>
  );
  const cls =
    "flex w-full items-center gap-2.5 rounded-md px-3.5 py-2 text-left transition hover:bg-ink-2";

  if (asLink && href) {
    return (
      <Link to={href} className={cls} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  if (external && href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls} onClick={onClick}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

export function DocsPopover() {
  const { apiBaseUrl, dataSource } = useApkzio();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const handleCopyApi = async () => {
    if (!apiBaseUrl) return;
    const ok = await copyToClipboard(apiBaseUrl);
    toast({
      title: ok ? "API URL copied" : "Copy failed",
      description: ok ? apiBaseUrl : "Clipboard access was denied by the browser.",
      tone: ok ? "success" : "error",
    });
  };

  const quickLinks: LinkRow[] = [
    { label: "API keys", href: "/keys", icon: "Key" },
    { label: "APK Builder", href: "/builder", icon: "Hammer" },
    { label: "Settings", href: "/settings", icon: "Cog" },
  ];

  const resourceLinks: LinkRow[] = [
    { label: "Documentation", href: "https://docs.apkzio.dev", icon: "External", external: true },
    { label: "Status page", href: "https://status.apkzio.dev", icon: "Globe", external: true },
    { label: "Contact support", href: "mailto:support@apkzio.dev", icon: "Send", external: true },
  ];

  const trigger = (
    <button
      type="button"
      aria-label="Documentation"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      className="relative grid h-9 w-9 place-items-center rounded-md text-bone-mid transition hover:bg-ink-3 hover:text-bone"
    >
      <Icon.External size={16} />
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen} trigger={trigger} align="right" width={320}>
      <div className="border-b border-line-1 px-3.5 py-2.5">
        <div className="font-display text-[13px] font-semibold text-bone">Documentation</div>
      </div>

      <div className="py-1">
        {apiBaseUrl ? (
          <>
            <SectionLabel>API endpoint</SectionLabel>
            <div className="px-3.5 pb-1.5 pt-0.5">
              <div className="flex items-center gap-2 rounded-md border border-line-1 bg-ink-2/60 px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-bone-mid">
                  {apiBaseUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopyApi}
                  aria-label="Copy API URL"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-bone-low transition hover:bg-ink-3 hover:text-bone"
                >
                  <Icon.Copy size={12} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <SectionLabel>API endpoint</SectionLabel>
            <div className="px-3.5 pb-1.5 pt-0.5 text-[12px] text-bone-low">
              REST mode disabled — set VITE_APKZIO_API_URL.
            </div>
          </>
        )}

        <SectionLabel>Quick links</SectionLabel>
        <div className="px-1.5 pb-1">
          {quickLinks.map((l) => (
            <RowButton
              key={l.label}
              icon={l.icon}
              label={l.label}
              href={l.href}
              asLink
              onClick={close}
              trailing={<Icon.ChevronRight size={12} className="text-bone-low" />}
            />
          ))}
          {apiBaseUrl && (
            <RowButton
              icon="External"
              label="Open API health"
              href={`${apiBaseUrl}/health`}
              external
              onClick={close}
              trailing={<Icon.ArrowRight size={12} className="text-bone-low" />}
            />
          )}
        </div>

        <SectionLabel>Resources</SectionLabel>
        <div className="px-1.5 pb-2">
          {resourceLinks.map((l) => (
            <RowButton
              key={l.label}
              icon={l.icon}
              label={l.label}
              href={l.href}
              external
              onClick={close}
              trailing={<Icon.ArrowRight size={12} className="text-bone-low" />}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-line-1 px-3.5 py-2 text-[11px] text-bone-low">
        Workspace · {dataSource.toUpperCase()}
      </div>
    </Popover>
  );
}

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const checks = [
  {
    file: "src/components/layout/Layout.tsx",
    includes: ["CommandPalette", "event.key.toLowerCase() === \"k\""],
  },
  {
    file: "src/components/layout/Topbar.tsx",
    includes: ["NotificationsPopover", "DocsPopover", "onOpenCommandPalette"],
  },
  {
    file: "src/pages/ApiKeys.tsx",
    includes: ["createApiKey", "revokeApiKey", "Secret copied"],
  },
  {
    file: "src/pages/NewCampaign.tsx",
    includes: ["createCampaign", "campaignFormIssues", "Send this push now?"],
  },
  {
    file: "src/pages/CampaignDetail.tsx",
    includes: ["pauseCampaignById", "cancelCampaignById", "Duplicate"],
  },
  {
    file: "src/pages/Apps.tsx",
    includes: ["createApp", "Package name should look like"],
  },
  {
    file: "src/pages/AppDetail.tsx",
    includes: ["updateApp", "App settings saved", "Delete app"],
  },
  {
    file: "src/hooks/useAnalyticsOverview.ts",
    includes: ["loading", "error", "Failed to load analytics"],
  },
  {
    file: "src/pages/Analytics.tsx",
    includes: ["downloadCsv", "Export event", "setSelectedEvent"],
  },
  {
    file: "src/pages/Campaigns.tsx",
    includes: ["downloadCsv", "Campaigns CSV downloaded"],
  },
  {
    file: "src/pages/Devices.tsx",
    includes: ["downloadCsv", "Devices CSV downloaded"],
  },
  {
    file: "src/pages/Subscribers.tsx",
    includes: ["downloadCsv", "api.updateSubscriber", "Invalidate", "Restore"],
  },
];

const failures = [];

for (const check of checks) {
  const source = readFileSync(join(root, check.file), "utf8");
  for (const needle of check.includes) {
    if (!source.includes(needle)) {
      failures.push(`${check.file} is missing ${JSON.stringify(needle)}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Admin UI verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Admin UI verification passed (${checks.length} files checked).`);

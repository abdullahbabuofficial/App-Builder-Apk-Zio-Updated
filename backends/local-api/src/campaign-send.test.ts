import { describe, expect, it } from "vitest";
import { ApkZioStore } from "./store.js";

function makeStore(): ApkZioStore {
  return new ApkZioStore("sk_test_local");
}

describe("campaign draft send", () => {
  it("sends duplicated draft campaigns and recalculates delivery counts", async () => {
    const store = makeStore();
    const source = store.campaigns[0]!;
    const draft = await store.duplicateCampaign(source.id);

    expect(draft.status).toBe("draft");
    expect(draft.sent_count).toBe(0);

    const sent = await store.sendDraftCampaign(draft.id);

    expect(sent.status).toBe("sent");
    expect(sent.sent_at).toEqual(expect.any(String));
    expect(sent.scheduled_at).toBeNull();
    expect(sent.recipients_count).toBeGreaterThan(0);
    expect(sent.sent_count).toBe(sent.recipients_count);
    expect(sent.delivered_count).toBeLessThanOrEqual(sent.sent_count);
  });

  it("rejects non-draft campaign sends", async () => {
    const store = makeStore();
    const alreadySent = store.campaigns.find((campaign) => campaign.status === "sent")!;

    await expect(() => store.sendDraftCampaign(alreadySent.id)).rejects.toThrow("invalid_state");
  });
});

describe("subscriber token actions", () => {
  it("toggles subscriber validity for admin token management", async () => {
    const store = makeStore();
    const app = [...store.apps.values()][0]!;
    const sub = (await store.getSubscribersForApp(app.id))[0]!;

    const invalid = await store.updateSubscriberValidity(sub.id, false);
    expect(invalid.is_valid).toBe(false);

    const restored = await store.updateSubscriberValidity(sub.id, true);
    expect(restored.is_valid).toBe(true);
  });
});

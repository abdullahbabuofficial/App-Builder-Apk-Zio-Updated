import { describe, expect, it } from "vitest";
import { ApkZioStore } from "./store.js";

describe("billing and wallet-like flows", () => {
  it("rejects checkout on empty cart", () => {
    const store = new ApkZioStore("sk_live_demo_apkzio_local");
    const user = store.createUser({
      email: "billing-empty@example.com",
      password: "StrongPass#123",
      full_name: "Billing Empty",
    });
    expect(() => store.checkout(user.id)).toThrowError("empty_cart");
  });

  it("creates invoice and payment records on checkout", () => {
    const store = new ApkZioStore("sk_live_demo_apkzio_local");
    const user = store.createUser({
      email: "billing-success@example.com",
      password: "StrongPass#123",
      full_name: "Billing Success",
    });

    store.addCartItem(user.id, {
      name: "Pro Plan",
      description: "monthly",
      price: 29,
      quantity: 1,
    });
    store.applyPromo(user.id, "APKZIO10");
    const invoice = store.checkout(user.id);

    expect(invoice.status).toBe("paid");
    expect(invoice.total).toBe(26.1);
    expect(store.listPayments(user.id)).toHaveLength(1);
    expect(store.listSubscriptions(user.id)).toHaveLength(1);
    expect(store.getCart(user.id).items).toHaveLength(0);
  });
});

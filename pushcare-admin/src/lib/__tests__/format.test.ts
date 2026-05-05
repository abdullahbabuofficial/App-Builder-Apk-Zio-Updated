import { describe, it, expect } from "vitest";
import {
  compact,
  commas,
  pct,
  delta,
  relTime,
  shortDate,
  dateTime,
  bytes,
  ms,
} from "@/lib/format";

describe("compact", () => {
  it("formats zero", () => {
    expect(compact(0)).toBe("0");
  });
  it("formats sub-thousand as plain integer", () => {
    expect(compact(412)).toBe("412");
  });
  it("formats thousands with k suffix", () => {
    expect(compact(23_100)).toBe("23.1k");
  });
  it("trims trailing zero on round numbers", () => {
    expect(compact(2_000)).toBe("2k");
  });
  it("formats millions", () => {
    expect(compact(1_400_000)).toBe("1.4M");
  });
  it("formats billions", () => {
    expect(compact(2_000_000_000)).toBe("2B");
  });
  it("preserves negatives", () => {
    expect(compact(-1500)).toBe("-1.5k");
  });
});

describe("commas", () => {
  it("inserts thousands separators", () => {
    expect(commas(1234567)).toBe("1,234,567");
  });
});

describe("pct", () => {
  it("formats with default 1 decimal", () => {
    expect(pct(12.345)).toBe("12.3%");
  });
  it("respects custom precision", () => {
    expect(pct(12.345, 2)).toBe("12.35%");
  });
});

describe("delta", () => {
  it("returns flat for zero", () => {
    expect(delta(0)).toEqual({ sign: "flat", label: "0%" });
  });
  it("prefixes positive", () => {
    expect(delta(3.5)).toEqual({ sign: "up", label: "+3.5%" });
  });
  it("formats negative without extra prefix", () => {
    expect(delta(-2.4)).toEqual({ sign: "down", label: "-2.4%" });
  });
});

describe("relTime", () => {
  it("returns 'just now' for very recent", () => {
    expect(relTime(Date.now() - 1000)).toBe("just now");
  });
  it("returns seconds for short past", () => {
    expect(relTime(Date.now() - 12_000)).toMatch(/^\d+s ago$/);
  });
  it("returns minutes for ~5m past", () => {
    expect(relTime(Date.now() - 5 * 60_000)).toMatch(/^\d+m ago$/);
  });
  it("returns hours for ~3h past", () => {
    expect(relTime(Date.now() - 3 * 3600_000)).toMatch(/^\d+h ago$/);
  });
  it("returns days for ~3d past", () => {
    expect(relTime(Date.now() - 3 * 86400_000)).toMatch(/^\d+d ago$/);
  });
});

describe("shortDate / dateTime", () => {
  it("shortDate produces a non-empty string", () => {
    expect(shortDate(new Date("2024-04-28T10:00:00Z")).length).toBeGreaterThan(0);
  });
  it("dateTime contains a colon (time component)", () => {
    expect(dateTime(new Date("2024-04-28T10:00:00Z"))).toMatch(/:/);
  });
});

describe("bytes", () => {
  it("formats raw bytes without decimals", () => {
    expect(bytes(512)).toBe("512 B");
  });
  it("formats KB with one decimal", () => {
    expect(bytes(1500)).toBe("1.5 KB");
  });
  it("formats MB", () => {
    expect(bytes(24 * 1024 * 1024)).toBe("24 MB");
  });
});

describe("ms", () => {
  it("formats sub-second as ms", () => {
    expect(ms(245)).toBe("245ms");
  });
  it("formats seconds with one decimal", () => {
    expect(ms(2400)).toBe("2.4s");
  });
  it("formats minutes + seconds", () => {
    expect(ms(83_000)).toBe("1m 23s");
  });
});

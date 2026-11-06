import { describe, expect, it } from "vitest";
import { shouldRefreshSquareToken } from "./access-token";

const now = new Date("2026-11-06T15:00:00Z");

describe("Square token renewal", () => {
  it("keeps a token that was renewed yesterday and still has weeks left", () => {
    expect(
      shouldRefreshSquareToken({
        updatedAt: "2026-11-05T15:00:00Z",
        expiresAt: "2026-12-05T15:00:00Z",
        now,
      })
    ).toBe(false);
  });

  it("renews a token older than 7 days and a token inside the expiry window", () => {
    expect(
      shouldRefreshSquareToken({
        updatedAt: "2026-10-29T15:00:00Z",
        expiresAt: "2026-11-28T15:00:00Z",
        now,
      })
    ).toBe(true);
    expect(
      shouldRefreshSquareToken({
        updatedAt: "2026-11-05T15:00:00Z",
        expiresAt: "2026-11-07T10:00:00Z",
        now,
      })
    ).toBe(true);
    expect(
      shouldRefreshSquareToken({ updatedAt: null, expiresAt: "2026-12-05T15:00:00Z", now })
    ).toBe(true);
  });
});

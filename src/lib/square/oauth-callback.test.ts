import { describe, expect, it } from "vitest";
import { assessOAuthCallback, isSquareMerchantId } from "./oauth-callback";

const consumed = {
  userId: "user-1",
  companyId: "company-1",
  purpose: "connect" as const,
};

describe("Square OAuth callback", () => {
  it("accepts a code only for the owner who started it", () => {
    const ok = assessOAuthCallback({
      error: null,
      code: "auth-code",
      state: "state",
      consumed,
      sessionUserId: "user-1",
      isOwner: true,
    });
    expect(ok).toEqual({ ok: true, code: "auth-code", consumed });
  });

  it("rejects a denial, a reused state, and a different user", () => {
    expect(
      assessOAuthCallback({
        error: "access_denied",
        code: null,
        state: "state",
        consumed,
        sessionUserId: "user-1",
        isOwner: true,
      }).ok
    ).toBe(false);
    expect(
      assessOAuthCallback({
        error: null,
        code: "auth-code",
        state: "state",
        consumed: null,
        sessionUserId: "user-1",
        isOwner: true,
      })
    ).toMatchObject({ reason: "invalid_state" });
    expect(
      assessOAuthCallback({
        error: null,
        code: "auth-code",
        state: "state",
        consumed,
        sessionUserId: "someone-else",
        isOwner: true,
      })
    ).toMatchObject({ reason: "forbidden" });
  });

  it("accepts a Square merchant id and rejects a blank one", () => {
    expect(isSquareMerchantId("MLJ8X84QK0Y1N")).toBe(true);
    expect(isSquareMerchantId("")).toBe(false);
    expect(isSquareMerchantId("not a merchant")).toBe(false);
  });
});

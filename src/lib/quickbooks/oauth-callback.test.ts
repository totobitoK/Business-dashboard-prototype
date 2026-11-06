import { describe, expect, it } from "vitest";
import { QUICKBOOKS_ACCOUNTING_SCOPE } from "./config";
import { buildQuickBooksAuthorizeUrl } from "./config";
import { assessOAuthCallback } from "./oauth-callback";

const consumed = { userId: "user-1", companyId: "company-1", purpose: "connect" as const };

describe("QuickBooks OAuth callback checks", () => {
  it("builds an Accounting-only authorize URL", () => {
    const url = buildQuickBooksAuthorizeUrl({
      clientId: "client",
      redirectUri: "http://localhost:3000/api/integrations/quickbooks/callback",
      state: "state-1",
    });
    expect(url.origin + url.pathname).toBe("https://appcenter.intuit.com/connect/oauth2");
    expect(url.searchParams.get("scope")).toBe(QUICKBOOKS_ACCOUNTING_SCOPE);
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).not.toContain("payment");
  });

  it("rejects a missing, mismatched, or unauthorized callback", () => {
    expect(
      assessOAuthCallback({
        error: "access_denied",
        code: null,
        state: null,
        realmId: null,
        consumed: null,
        sessionUserId: null,
        isOwner: false,
      }).ok
    ).toBe(false);

    expect(
      assessOAuthCallback({
        error: null,
        code: "code",
        state: null,
        realmId: "123",
        consumed,
        sessionUserId: "user-1",
        isOwner: true,
      })
    ).toMatchObject({ ok: false, reason: "invalid_callback" });

    expect(
      assessOAuthCallback({
        error: null,
        code: "code",
        state: "state",
        realmId: "not-a-realm",
        consumed,
        sessionUserId: "user-1",
        isOwner: true,
      })
    ).toMatchObject({ ok: false, reason: "invalid_realm" });

    expect(
      assessOAuthCallback({
        error: null,
        code: "code",
        state: "state",
        realmId: "4620816365234567890",
        consumed: null,
        sessionUserId: "user-1",
        isOwner: true,
      })
    ).toMatchObject({ ok: false, reason: "invalid_state" });

    expect(
      assessOAuthCallback({
        error: null,
        code: "code",
        state: "state",
        realmId: "4620816365234567890",
        consumed,
        sessionUserId: "someone-else",
        isOwner: true,
      })
    ).toMatchObject({ ok: false, reason: "forbidden" });

    expect(
      assessOAuthCallback({
        error: null,
        code: "code",
        state: "state",
        realmId: "4620816365234567890",
        consumed,
        sessionUserId: "user-1",
        isOwner: false,
      })
    ).toMatchObject({ ok: false, reason: "forbidden" });
  });

  it("accepts the initiating owner with a numeric realm id", () => {
    const result = assessOAuthCallback({
      error: null,
      code: "auth-code",
      state: "state",
      realmId: "4620816365234567890",
      consumed,
      sessionUserId: "user-1",
      isOwner: true,
    });
    expect(result).toMatchObject({
      ok: true,
      code: "auth-code",
      realmId: "4620816365234567890",
      consumed,
    });
  });
});

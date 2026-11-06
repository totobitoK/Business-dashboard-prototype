import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAccessToken } from "./access-token";
import { IntuitOAuthError } from "./intuit-oauth";

afterEach(() => {
  vi.unstubAllEnvs();
});

function sandboxEnv() {
  vi.stubEnv("QUICKBOOKS_ENVIRONMENT", "sandbox");
  vi.stubEnv("QUICKBOOKS_SANDBOX_CLIENT_ID", "sandbox-client");
  vi.stubEnv("QUICKBOOKS_SANDBOX_CLIENT_SECRET", "sandbox-secret");
  vi.stubEnv("QUICKBOOKS_SANDBOX_TOKEN_ENCRYPTION_KEY", "sandbox-key-at-least-32-characters");
}

describe("QuickBooks token refresh", () => {
  it("reuses an unexpired access token", async () => {
    const refresh = vi.fn();
    const persist = vi.fn();
    const token = await resolveAccessToken({
      now: new Date("2026-11-05T12:00:00Z"),
      secrets: {
        accessToken: "still-good",
        accessTokenExpiresAt: new Date("2026-11-05T13:00:00Z"),
        refreshToken: "refresh-1",
      },
      refresh,
      persist,
    });
    expect(token).toBe("still-good");
    expect(refresh).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("stores the rotated refresh token when the access token is expired", async () => {
    sandboxEnv();
    const refresh = vi.fn().mockResolvedValue({
      accessToken: "access-2",
      refreshToken: "refresh-2",
      expiresIn: 3600,
      refreshTokenExpiresIn: 8726400,
    });
    const persist = vi.fn().mockResolvedValue(true);
    const token = await resolveAccessToken({
      now: new Date("2026-11-05T12:00:00Z"),
      secrets: {
        accessToken: "expired",
        accessTokenExpiresAt: new Date("2026-11-05T11:00:00Z"),
        refreshToken: "refresh-1",
      },
      refresh,
      persist,
    });
    expect(token).toBe("access-2");
    expect(refresh).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: "refresh-1", clientId: "sandbox-client" })
    );
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshToken: "refresh-2",
        accessToken: "access-2",
      })
    );
  });

  it("requires reconnect when Intuit rejects the refresh token", async () => {
    sandboxEnv();
    const persist = vi.fn();
    await expect(
      resolveAccessToken({
        now: new Date("2026-11-05T12:00:00Z"),
        secrets: {
          accessToken: null,
          accessTokenExpiresAt: null,
          refreshToken: "refresh-1",
        },
        refresh: vi.fn().mockRejectedValue(new IntuitOAuthError("invalid_grant", 400)),
        persist,
      })
    ).rejects.toThrow("RECONNECT_REQUIRED");
    expect(persist).not.toHaveBeenCalled();
  });
});

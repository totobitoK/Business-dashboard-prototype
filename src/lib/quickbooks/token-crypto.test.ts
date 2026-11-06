import { afterEach, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "./token-crypto";

afterEach(() => {
  delete process.env.QUICKBOOKS_ENVIRONMENT;
  delete process.env.QUICKBOOKS_SANDBOX_CLIENT_ID;
  delete process.env.QUICKBOOKS_SANDBOX_CLIENT_SECRET;
  delete process.env.QUICKBOOKS_SANDBOX_TOKEN_ENCRYPTION_KEY;
  delete process.env.QUICKBOOKS_PRODUCTION_CLIENT_ID;
  delete process.env.QUICKBOOKS_PRODUCTION_CLIENT_SECRET;
  delete process.env.QUICKBOOKS_PRODUCTION_TOKEN_ENCRYPTION_KEY;
});

describe("QuickBooks token crypto", () => {
  it("round-trips with the active environment key and rejects the other environment's key", () => {
    process.env.QUICKBOOKS_ENVIRONMENT = "sandbox";
    process.env.QUICKBOOKS_SANDBOX_CLIENT_ID = "sandbox-client";
    process.env.QUICKBOOKS_SANDBOX_CLIENT_SECRET = "sandbox-secret";
    process.env.QUICKBOOKS_SANDBOX_TOKEN_ENCRYPTION_KEY = "sandbox-key-at-least-32-characters";
    const encrypted = encryptToken("refresh-token");
    expect(decryptToken(encrypted)).toBe("refresh-token");

    process.env.QUICKBOOKS_ENVIRONMENT = "production";
    process.env.QUICKBOOKS_PRODUCTION_CLIENT_ID = "production-client";
    process.env.QUICKBOOKS_PRODUCTION_CLIENT_SECRET = "production-secret";
    process.env.QUICKBOOKS_PRODUCTION_TOKEN_ENCRYPTION_KEY = "production-key-at-least-32-characters!";
    expect(() => decryptToken(encrypted)).toThrow();
  });
});

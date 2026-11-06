import { afterEach, describe, expect, it } from "vitest";
import { buildSquareAuthorizeUrl, isSquareConnectAllowed, squareHost } from "./config";

const KEYS = [
  "SQUARE_ENVIRONMENT",
  "SQUARE_SANDBOX_QA",
  "SQUARE_INTEGRATION_ENABLED",
  "SQUARE_CONNECTOR_VERIFIED",
  "SQUARE_SANDBOX_CLIENT_ID",
  "SQUARE_SANDBOX_CLIENT_SECRET",
  "SQUARE_SANDBOX_TOKEN_ENCRYPTION_KEY",
  "SQUARE_PRODUCTION_CLIENT_ID",
  "SQUARE_PRODUCTION_CLIENT_SECRET",
  "SQUARE_PRODUCTION_TOKEN_ENCRYPTION_KEY",
] as const;

const previous = new Map<string, string | undefined>();

function remember() {
  for (const key of KEYS) previous.set(key, process.env[key]);
}

function restore() {
  for (const key of KEYS) {
    const value = previous.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previous.clear();
}

describe("Square environment separation", () => {
  afterEach(restore);

  it("sends sandbox sellers to the sandbox host with read scopes only", () => {
    const url = buildSquareAuthorizeUrl({
      clientId: "sandbox-sq0idb-example",
      state: "state",
      environment: "sandbox",
    });
    expect(url.origin).toBe("https://connect.squareupsandbox.com");
    expect(url.searchParams.get("scope")).toBe("MERCHANT_PROFILE_READ PAYMENTS_READ");
    expect(url.searchParams.get("scope")).not.toContain("WRITE");
    expect(squareHost("production")).toBe("https://connect.squareup.com");
  });

  it("allows sandbox QA without the customer verification flag", () => {
    remember();
    delete process.env.SQUARE_INTEGRATION_ENABLED;
    delete process.env.SQUARE_CONNECTOR_VERIFIED;
    process.env.SQUARE_ENVIRONMENT = "sandbox";
    process.env.SQUARE_SANDBOX_QA = "true";
    process.env.SQUARE_SANDBOX_CLIENT_ID = "sandbox-app";
    process.env.SQUARE_SANDBOX_CLIENT_SECRET = "sandbox-secret";
    process.env.SQUARE_SANDBOX_TOKEN_ENCRYPTION_KEY = "sandbox-key-at-least-32-characters";
    expect(isSquareConnectAllowed()).toBe(true);
    process.env.SQUARE_ENVIRONMENT = "production";
    process.env.SQUARE_PRODUCTION_CLIENT_ID = "production-app";
    process.env.SQUARE_PRODUCTION_CLIENT_SECRET = "production-secret";
    process.env.SQUARE_PRODUCTION_TOKEN_ENCRYPTION_KEY = "production-key-at-least-32-characters";
    expect(isSquareConnectAllowed()).toBe(false);
  });
});

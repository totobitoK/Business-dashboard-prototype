import { afterEach, describe, expect, it } from "vitest";
import { CONNECTOR_DEFINITIONS } from "./connector-catalog";
import {
  connectorCanConnect,
  getConnectorPublicPhase,
  getPublicMarketingConnectors,
  getPublicStatusBadge,
} from "./connector-presentation";

const QBO_ENV_KEYS = [
  "QUICKBOOKS_ENVIRONMENT",
  "QUICKBOOKS_INTEGRATION_ENABLED",
  "QUICKBOOKS_CONNECTOR_VERIFIED",
  "QUICKBOOKS_SANDBOX_QA",
  "QUICKBOOKS_SANDBOX_CLIENT_ID",
  "QUICKBOOKS_SANDBOX_CLIENT_SECRET",
  "QUICKBOOKS_SANDBOX_TOKEN_ENCRYPTION_KEY",
  "QUICKBOOKS_PRODUCTION_CLIENT_ID",
  "QUICKBOOKS_PRODUCTION_CLIENT_SECRET",
  "QUICKBOOKS_PRODUCTION_TOKEN_ENCRYPTION_KEY",
] as const;

const previousQboEnv = new Map<string, string | undefined>();
let qboEnvCaptured = false;

function rememberQboEnv() {
  if (qboEnvCaptured) return;
  for (const key of QBO_ENV_KEYS) previousQboEnv.set(key, process.env[key]);
  qboEnvCaptured = true;
}

function restoreQboEnv() {
  if (!qboEnvCaptured) return;
  for (const key of QBO_ENV_KEYS) {
    const value = previousQboEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previousQboEnv.clear();
  qboEnvCaptured = false;
}

describe("connector presentation policy", () => {
  it("hides public marketing connectors during private build", () => {
    expect(getConnectorPublicPhase()).toBe("private_build");
    expect(getPublicMarketingConnectors("private_build")).toHaveLength(0);
  });

  it("shows no public status badges during private build", () => {
    for (const c of CONNECTOR_DEFINITIONS) {
      expect(getPublicStatusBadge(c, "private_build")).toBeNull();
    }
  });

  it("at launch advertises operational connectors and optional coming soon teasers only", () => {
    const launchList = getPublicMarketingConnectors("launch");
    expect(launchList.every((c) => c.implementationStatus === "operational" || c.publicTeaser === "coming_soon")).toBe(
      true
    );
    expect(launchList.some((c) => c.implementationStatus === "candidate")).toBe(false);
    expect(launchList.some((c) => c.id === "quickbooks")).toBe(false);
    expect(launchList.some((c) => c.id === "square")).toBe(false);
  });

  it("gates Connect on operational status and runtime configuration", () => {
    rememberQboEnv();
    delete process.env.QUICKBOOKS_SANDBOX_QA;
    delete process.env.QUICKBOOKS_INTEGRATION_ENABLED;
    delete process.env.QUICKBOOKS_CONNECTOR_VERIFIED;
    const squareKeys = ["SQUARE_SANDBOX_QA", "SQUARE_INTEGRATION_ENABLED", "SQUARE_CONNECTOR_VERIFIED"] as const;
    const squareEnv = squareKeys.map((key) => [key, process.env[key]] as const);
    for (const key of squareKeys) delete process.env[key];
    const calendar = CONNECTOR_DEFINITIONS.find((c) => c.id === "google-calendar")!;
    expect(calendar.implementationStatus).toBe("in_development");
    expect(connectorCanConnect(calendar)).toBe(false);
    const quickbooks = CONNECTOR_DEFINITIONS.find((c) => c.id === "quickbooks")!;
    expect(quickbooks.implementationStatus).toBe("in_development");
    expect(connectorCanConnect(quickbooks)).toBe(false);
    const square = CONNECTOR_DEFINITIONS.find((c) => c.id === "square")!;
    expect(square.implementationStatus).toBe("in_development");
    expect(connectorCanConnect(square)).toBe(false);
    for (const [key, value] of squareEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    expect(
      connectorCanConnect({
        ...quickbooks,
        implementationStatus: "operational",
      })
    ).toBe(false);
  });

  it("allows QuickBooks connect only when that environment is configured and verified", () => {
    rememberQboEnv();
    process.env.QUICKBOOKS_ENVIRONMENT = "sandbox";
    process.env.QUICKBOOKS_INTEGRATION_ENABLED = "true";
    process.env.QUICKBOOKS_CONNECTOR_VERIFIED = "true";
    process.env.QUICKBOOKS_SANDBOX_CLIENT_ID = "sandbox-client";
    process.env.QUICKBOOKS_SANDBOX_CLIENT_SECRET = "sandbox-secret";
    process.env.QUICKBOOKS_SANDBOX_TOKEN_ENCRYPTION_KEY = "sandbox-key-at-least-32-characters";
    process.env.QUICKBOOKS_PRODUCTION_CLIENT_ID = "production-client";
    const quickbooks = CONNECTOR_DEFINITIONS.find((c) => c.id === "quickbooks")!;
    expect(connectorCanConnect(quickbooks)).toBe(true);
    process.env.QUICKBOOKS_ENVIRONMENT = "production";
    expect(connectorCanConnect(quickbooks)).toBe(false);
  });

  it("allows sandbox QA without marking QuickBooks verified or connectable in production", () => {
    rememberQboEnv();
    delete process.env.QUICKBOOKS_INTEGRATION_ENABLED;
    delete process.env.QUICKBOOKS_CONNECTOR_VERIFIED;
    process.env.QUICKBOOKS_ENVIRONMENT = "sandbox";
    process.env.QUICKBOOKS_SANDBOX_QA = "true";
    process.env.QUICKBOOKS_SANDBOX_CLIENT_ID = "sandbox-client";
    process.env.QUICKBOOKS_SANDBOX_CLIENT_SECRET = "sandbox-secret";
    process.env.QUICKBOOKS_SANDBOX_TOKEN_ENCRYPTION_KEY = "sandbox-key-at-least-32-characters";
    const quickbooks = CONNECTOR_DEFINITIONS.find((c) => c.id === "quickbooks")!;
    expect(connectorCanConnect(quickbooks)).toBe(true);
    process.env.QUICKBOOKS_ENVIRONMENT = "production";
    process.env.QUICKBOOKS_PRODUCTION_CLIENT_ID = "production-client";
    process.env.QUICKBOOKS_PRODUCTION_CLIENT_SECRET = "production-secret";
    process.env.QUICKBOOKS_PRODUCTION_TOKEN_ENCRYPTION_KEY = "production-key-at-least-32-characters!";
    expect(connectorCanConnect(quickbooks)).toBe(false);
  });

  afterEach(() => {
    restoreQboEnv();
  });
});

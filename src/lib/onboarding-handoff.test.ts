import { describe, expect, it } from "vitest";
import { demoClients } from "./demo-data";
import {
  getAgreedScopeToolLabels,
  getOutstandingCustomerRequests,
} from "./onboarding-handoff";
import type { Client } from "./types";

describe("getOutstandingCustomerRequests", () => {
  it("returns only recorded customer notes", () => {
    const client: Client = {
      ...demoClients[0]!,
      previewFeedbackUnresolved: true,
      previewChangeRequest: "Add weekly revenue trend",
      scopeChangeRequestAt: "2026-01-01T00:00:00.000Z",
      scopeChangeRequestNote: "Include payroll export",
    };
    expect(getOutstandingCustomerRequests(client)).toEqual([
      "Add weekly revenue trend",
      "Include payroll export",
    ]);
  });

  it("returns empty when no open requests", () => {
    const client: Client = {
      ...demoClients[0]!,
      previewFeedbackUnresolved: false,
      previewChangeRequest: undefined,
      scopeChangeRequestAt: undefined,
      scopeChangeRequestNote: undefined,
    };
    expect(getOutstandingCustomerRequests(client)).toEqual([]);
  });
});

describe("getAgreedScopeToolLabels", () => {
  it("uses acceptedSourcesIn only", () => {
    const client: Client = {
      ...demoClients[0]!,
      acceptedSourcesIn: ["Stripe", "Google Calendar"],
    };
    expect(getAgreedScopeToolLabels(client)).toEqual(["Stripe", "Google Calendar"]);
  });
});

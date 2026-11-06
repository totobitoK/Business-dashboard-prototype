import { describe, expect, it, vi } from "vitest";
import { qboReadJson, readCompanyProfile } from "./qbo-read";

describe("QuickBooks read API", () => {
  it("sends GET to the sandbox host and reads a company time zone", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        CompanyInfo: {
          CompanyName: "Sandbox Company",
          NameValue: [{ Name: "CompanyTimeZone", Value: "America/Chicago" }],
        },
      }),
    });
    const body = await qboReadJson({
      environment: "sandbox",
      realmId: "123456789",
      resourcePath: "companyinfo/123456789",
      accessToken: "access",
      fetchImpl,
    });
    const [url, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toContain("https://sandbox-quickbooks.api.intuit.com/v3/company/123456789/");
    expect(String(url)).not.toContain("https://quickbooks.api.intuit.com/");
    expect(init.method).toBe("GET");
    expect(readCompanyProfile(body)).toEqual({
      name: "Sandbox Company",
      timeZone: "America/Chicago",
    });
  });

  it("uses the production host only for a production connection", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ QueryResponse: { Invoice: [] } }),
    });
    await qboReadJson({
      environment: "production",
      realmId: "123456789",
      resourcePath: "query",
      query: { query: "select Id from Invoice where Balance > '0' startposition 1 maxresults 1000" },
      accessToken: "access",
      fetchImpl,
    });
    const [url, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(String(url).startsWith("https://quickbooks.api.intuit.com/v3/company/123456789/query")).toBe(
      true
    );
    expect(init.method).toBe("GET");
  });
});

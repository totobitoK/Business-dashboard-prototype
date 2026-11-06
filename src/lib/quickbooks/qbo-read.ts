import {
  QUICKBOOKS_MINOR_VERSION,
  quickBooksApiBase,
  type IntuitEnvironment,
} from "./config";
import { isValidIanaTimeZone } from "./reporting-date";

export class QuickBooksReadError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export function intuitFaultCode(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as {
    fault?: { error?: Array<{ code?: string }> };
    Fault?: { Error?: Array<{ code?: string }> };
  };
  const errors = record.fault?.error ?? record.Fault?.Error;
  const code = errors?.[0]?.code;
  return code ? String(code) : null;
}

/**
 * Accounting API reads only. Callers cannot choose the HTTP method.
 * The host comes from the stored Intuit environment, not from request input.
 */
export async function qboReadJson(params: {
  environment: IntuitEnvironment;
  realmId: string;
  resourcePath: string;
  query?: Record<string, string>;
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<unknown> {
  if (!/^[0-9]{1,20}$/.test(params.realmId)) {
    throw new QuickBooksReadError(400, "INVALID_REALM");
  }
  if (
    params.resourcePath.startsWith("/") ||
    params.resourcePath.includes("..") ||
    params.resourcePath.includes("://")
  ) {
    throw new QuickBooksReadError(400, "INVALID_PATH");
  }
  const url = new URL(
    `${quickBooksApiBase(params.environment)}/v3/company/${params.realmId}/${params.resourcePath}`
  );
  if (params.query) {
    for (const [key, value] of Object.entries(params.query)) {
      url.searchParams.set(key, value);
    }
  }
  url.searchParams.set("minorversion", QUICKBOOKS_MINOR_VERSION);
  const response = await (params.fetchImpl ?? fetch)(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new QuickBooksReadError(response.status, intuitFaultCode(body) ?? `HTTP_${response.status}`);
  }
  return body;
}

export function readCompanyProfile(body: unknown): { name: string | null; timeZone: string | null } {
  if (!body || typeof body !== "object") return { name: null, timeZone: null };
  const info = ((body as { CompanyInfo?: Record<string, unknown> }).CompanyInfo ??
    body) as Record<string, unknown>;
  const name = typeof info.CompanyName === "string" ? info.CompanyName.slice(0, 200) : null;
  const pairs = Array.isArray(info.NameValue) ? info.NameValue : [];
  let timeZone: string | null = null;
  for (const pair of pairs) {
    if (!pair || typeof pair !== "object") continue;
    const key = String((pair as { Name?: string }).Name ?? "");
    const value = String((pair as { Value?: string }).Value ?? "");
    if (/time.?zone/i.test(key) && isValidIanaTimeZone(value)) {
      timeZone = value;
      break;
    }
  }
  return { name, timeZone };
}

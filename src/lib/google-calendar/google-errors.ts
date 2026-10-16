export type GoogleErrorKind = "permanent" | "transient";

export class GoogleApiError extends Error {
  readonly kind: GoogleErrorKind;
  readonly status: number;

  constructor(kind: GoogleErrorKind, status: number, code: string) {
    super(code);
    this.name = "GoogleApiError";
    this.kind = kind;
    this.status = status;
  }
}

export function classifyHttpStatus(status: number): GoogleErrorKind {
  if (status === 408 || status === 429 || status === 502 || status === 503 || status === 504) {
    return "transient";
  }
  if (status >= 500) return "transient";
  return "permanent";
}

export async function classifyOAuthTokenError(
  status: number,
  bodyText: string
): Promise<GoogleApiError> {
  if (status === 429 || status >= 500) {
    return new GoogleApiError("transient", status, `TOKEN_REFRESH_TRANSIENT:${status}`);
  }
  let parsed: { error?: string } | null = null;
  try {
    parsed = JSON.parse(bodyText) as { error?: string };
  } catch {
    parsed = null;
  }
  const oauthError = parsed?.error ?? "";
  if (
    status === 400 &&
    (oauthError === "invalid_grant" || bodyText.includes("invalid_grant"))
  ) {
    return new GoogleApiError("permanent", status, `TOKEN_REFRESH_PERMANENT:${status}`);
  }
  if (status === 401 || status === 403) {
    return new GoogleApiError("permanent", status, `TOKEN_REFRESH_PERMANENT:${status}`);
  }
  if (status >= 400 && status < 500) {
    return new GoogleApiError("permanent", status, `TOKEN_REFRESH_FAILED:${status}`);
  }
  return new GoogleApiError("transient", status, `TOKEN_REFRESH_TRANSIENT:${status}`);
}

export function isTransientGoogleError(e: unknown): boolean {
  return e instanceof GoogleApiError && e.kind === "transient";
}

export function isPermanentAuthError(e: unknown): boolean {
  return (
    e instanceof GoogleApiError &&
    e.kind === "permanent" &&
    e.message.startsWith("TOKEN_REFRESH_")
  );
}

import { describe, expect, it } from "vitest";
import { classifyHttpStatus, classifyOAuthTokenError } from "./google-errors";

describe("google-errors", () => {
  it("treats 429 and 5xx as transient", () => {
    expect(classifyHttpStatus(429)).toBe("transient");
    expect(classifyHttpStatus(503)).toBe("transient");
  });

  it("treats invalid_grant as permanent auth failure", async () => {
    const err = await classifyOAuthTokenError(
      400,
      JSON.stringify({ error: "invalid_grant", error_description: "revoked" })
    );
    expect(err.kind).toBe("permanent");
    expect(err.message).toContain("PERMANENT");
  });

  it("treats token endpoint 503 as transient", async () => {
    const err = await classifyOAuthTokenError(503, "upstream");
    expect(err.kind).toBe("transient");
  });
});

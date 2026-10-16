import { describe, expect, it } from "vitest";
import { sanitizeAuthRedirectPath } from "./safe-redirect";

describe("sanitizeAuthRedirectPath", () => {
  it("allows live dashboard and admin paths", () => {
    expect(sanitizeAuthRedirectPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeAuthRedirectPath("/admin/clients")).toBe("/admin/clients");
  });

  it("rejects external and demo open redirects", () => {
    expect(sanitizeAuthRedirectPath("//evil.com")).toBe("/dashboard");
    expect(sanitizeAuthRedirectPath("https://evil.com")).toBe("/dashboard");
    expect(sanitizeAuthRedirectPath("/demo/admin")).toBe("/dashboard");
    expect(sanitizeAuthRedirectPath("/login?next=/admin")).toBe("/dashboard");
  });
});

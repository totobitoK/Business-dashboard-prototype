import { describe, expect, it } from "vitest";
import { nextJobberRefreshToken } from "./config";

describe("nextJobberRefreshToken", () => {
  it("stores the rotated refresh token when Jobber returns one", () => {
    expect(
      nextJobberRefreshToken("old-token", {
        access_token: "access",
        refresh_token: "new-token",
      })
    ).toBe("new-token");
  });

  it("keeps the current refresh token when the response does not rotate it", () => {
    expect(nextJobberRefreshToken("old-token", { access_token: "access" })).toBe("old-token");
  });
});

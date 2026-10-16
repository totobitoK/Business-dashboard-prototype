import { describe, expect, it } from "vitest";
import { generateOAuthState, hashOAuthState } from "./oauth-state";

describe("oauth-state", () => {
  it("hashes states deterministically", () => {
    process.env.GOOGLE_OAUTH_STATE_SECRET = "state-secret-32chars-minimum!!!!!";
    const state = generateOAuthState();
    expect(hashOAuthState(state)).toHaveLength(64);
    expect(hashOAuthState(state)).toBe(hashOAuthState(state));
  });
});

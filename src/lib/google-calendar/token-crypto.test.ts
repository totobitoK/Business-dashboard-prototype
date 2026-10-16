import { beforeEach, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "./token-crypto";

describe("token-crypto", () => {
  beforeEach(() => {
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "test-key-at-least-32-characters-long!!";
  });

  it("round-trips tokens", () => {
    const plain = "ya29.refresh-or-access-token-value";
    expect(decryptToken(encryptToken(plain))).toBe(plain);
  });
});

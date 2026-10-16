import { describe, expect, it } from "vitest";
import { shouldRollImportWindow } from "./sync-window";
import { generationStillValid } from "./connection-generation";

describe("sync coordination helpers", () => {
  it("rolls import window when anchor is stale", () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(shouldRollImportWindow(old)).toBe(true);
    expect(shouldRollImportWindow(new Date().toISOString())).toBe(false);
  });

  it("invalidates stale workers after generation bump", () => {
    expect(generationStillValid(3, 2)).toBe(false);
    expect(generationStillValid(3, 3)).toBe(true);
  });
});

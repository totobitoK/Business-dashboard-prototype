import { describe, expect, it } from "vitest";
import {
  getWorkspaceBusinessData,
} from "./workspace-business-data";
import { isValidWorkspaceId, getWorkspaceById } from "./customer-workspaces";

describe("workspace isolation", () => {
  it("rejects unknown workspace ids", () => {
    expect(isValidWorkspaceId("ws-fake")).toBe(false);
    expect(getWorkspaceById("ws-fake")).toBeUndefined();
    expect(getWorkspaceBusinessData("ws-fake")).toBeUndefined();
  });

  it("returns distinct data per valid workspace", () => {
    const alpine = getWorkspaceBusinessData("ws-alpine-hvac");
    const meridian = getWorkspaceBusinessData("ws-meridian-retail");
    expect(alpine?.workspaceId).not.toBe(meridian?.workspaceId);
  });
});

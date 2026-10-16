import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listEventsPage } from "./google-api";

describe("listEventsPage query stability", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps incremental syncToken off page 2+ (pageToken only)", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: "a" }],
          nextPageToken: "page-2",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: "b" }],
          nextSyncToken: "sync-final",
        }),
      });

    await listEventsPage({
      accessToken: "tok",
      calendarId: "primary",
      query: { type: "incremental", syncToken: "sync-1" },
    });
    await listEventsPage({
      accessToken: "tok",
      calendarId: "primary",
      query: { type: "incremental", syncToken: "sync-1" },
      pageToken: "page-2",
    });

    const firstUrl = String(fetchMock.mock.calls[0]![0]);
    const secondUrl = String(fetchMock.mock.calls[1]![0]);
    expect(firstUrl).toContain("syncToken=sync-1");
    expect(firstUrl).not.toContain("timeMin=");
    expect(secondUrl).toContain("pageToken=page-2");
    expect(secondUrl).not.toContain("syncToken=");
    expect(secondUrl).not.toContain("timeMin=");
  });

  it("freezes full sync bounds on first page only", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], nextSyncToken: "x" }),
    });

    await listEventsPage({
      accessToken: "tok",
      calendarId: "primary",
      query: { type: "full", timeMin: "2026-01-01T00:00:00.000Z", timeMax: "2026-07-01T00:00:00.000Z" },
      pageToken: "p2",
    });

    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("pageToken=p2");
    expect(url).not.toContain("timeMin=");
    expect(url).not.toContain("timeMax=");
  });
});

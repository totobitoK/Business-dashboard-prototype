import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listEventsPage } from "./google-api";

describe("listEventsPage query stability (Google sync guide)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("repeats the same incremental query with syncToken and pageToken on later pages", async () => {
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

    const query = { type: "incremental" as const, syncToken: "sync-1" };
    await listEventsPage({ accessToken: "tok", calendarId: "primary", query });
    await listEventsPage({
      accessToken: "tok",
      calendarId: "primary",
      query,
      pageToken: "page-2",
    });

    const firstUrl = String(fetchMock.mock.calls[0]![0]);
    const secondUrl = String(fetchMock.mock.calls[1]![0]);
    expect(firstUrl).toContain("syncToken=sync-1");
    expect(firstUrl).not.toContain("pageToken=");
    expect(secondUrl).toContain("syncToken=sync-1");
    expect(secondUrl).toContain("pageToken=page-2");
    expect(secondUrl).not.toContain("timeMin=");
  });

  it("repeats frozen timeMin/timeMax with pageToken on full-sync pages", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], nextSyncToken: "x" }),
    });

    const query = {
      type: "full" as const,
      timeMin: "2026-01-01T00:00:00.000Z",
      timeMax: "2026-07-01T00:00:00.000Z",
    };
    await listEventsPage({
      accessToken: "tok",
      calendarId: "primary",
      query,
      pageToken: "p2",
    });

    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("pageToken=p2");
    expect(url).toContain("timeMin=2026-01-01T00%3A00%3A00.000Z");
    expect(url).toContain("timeMax=2026-07-01T00%3A00%3A00.000Z");
  });
});

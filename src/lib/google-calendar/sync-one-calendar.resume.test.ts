import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncOneCalendar } from "./sync-one-calendar";
import type { SyncProgress } from "./sync-progress";
import { sleep } from "./retry";

function mockAdmin() {
  const applyCalls: string[] = [];
  const reconcileCalls: string[][] = [];
  const admin = {
    rpc: (name: string, args: Record<string, unknown>) => {
      if (name === "google_calendar_sync_apply_event") {
        applyCalls.push(args.p_google_event_id as string);
        return Promise.resolve({ data: true, error: null });
      }
      if (name === "google_calendar_sync_reconcile_calendar") {
        reconcileCalls.push(args.p_seen_event_ids as string[]);
        return Promise.resolve({ data: 0, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as SupabaseClient;
  return { admin, applyCalls, reconcileCalls };
}

const cal = {
  id: "cal-row",
  google_calendar_id: "primary",
  sync_token: null,
  import_window_anchor_at: null,
};

describe("syncOneCalendar resumable full import", () => {
  it("resumes saved pageToken and seenEventIds, then reconciles once at end", async () => {
    const { admin, applyCalls, reconcileCalls } = mockAdmin();
    const listPage = vi.fn(async () => ({
      items: [{ id: "evt-2", summary: "Two", start: { dateTime: "2026-03-02T10:00:00Z" } }],
      nextSyncToken: "sync-new",
    }));

    const progress: SyncProgress = {
      generation: 1,
      calendarIndex: 0,
      googleCalendarId: "primary",
      pageToken: "page-2",
      mode: "full",
      timeMin: "2026-01-01T00:00:00.000Z",
      timeMax: "2026-07-01T00:00:00.000Z",
      seenEventIds: ["evt-1"],
    };

    const result = await syncOneCalendar(admin, {
      accessToken: "tok",
      companyId: "co",
      connectionId: "conn",
      generation: 1,
      workerId: "test-worker",
      cal,
      calendarIndex: 0,
      progress,
      startedAt: Date.now(),
      budgetMs: 60_000,
      listPage,
    });

    expect(result.done).toBe(true);
    expect(applyCalls).toEqual(["evt-2"]);
    expect(reconcileCalls).toEqual([["evt-1", "evt-2"]]);
    expect(listPage).toHaveBeenCalledTimes(1);
    expect(listPage.mock.calls[0]?.[0]?.pageToken).toBe("page-2");
    expect(listPage.mock.calls[0]?.[0]?.query).toEqual({
      type: "full",
      timeMin: progress.timeMin,
      timeMax: progress.timeMax,
    });
  });

  it("persists partial progress with pageToken when time budget expires mid-import", async () => {
    const { admin, reconcileCalls } = mockAdmin();
    const listPage = vi.fn(async (params: { pageToken?: string }) => {
      await sleep(10);
      if (!params.pageToken) {
        return {
          items: [{ id: "evt-1", summary: "One", start: { dateTime: "2026-03-01T10:00:00Z" } }],
          nextPageToken: "page-2",
        };
      }
      return {
        items: [{ id: "evt-2", summary: "Two", start: { dateTime: "2026-03-02T10:00:00Z" } }],
      };
    });

    const startedAt = Date.now() - 50;
    const first = await syncOneCalendar(admin, {
      accessToken: "tok",
      companyId: "co",
      connectionId: "conn",
      generation: 1,
      workerId: "test-worker",
      cal,
      calendarIndex: 0,
      progress: null,
      startedAt,
      budgetMs: 55,
      listPage,
    });

    expect(first.done).toBe(false);
    if (first.done) throw new Error("expected partial");
    expect(first.partial.pageToken).toBe("page-2");
    expect(first.partial.seenEventIds).toEqual(["evt-1"]);
    expect(reconcileCalls).toHaveLength(0);
  });
});

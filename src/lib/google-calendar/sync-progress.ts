export type SyncProgress = {
  generation: number;
  calendarIndex: number;
  googleCalendarId?: string;
  pageToken?: string;
  mode: "incremental" | "full";
  timeMin?: string;
  timeMax?: string;
  seenEventIds?: string[];
};

export function parseProgress(raw: unknown, generation: number): SyncProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as SyncProgress;
  if (p.generation !== generation) return null;
  return p;
}

import { normalizeClients } from "./client-migration";
import type { Client } from "./types";

export const CLIENT_DEMO_STORAGE_KEY = "client-operations-demo-data";

export type ClientListPersistResult =
  | { ok: true; clients: Client[] }
  | { ok: false; error: string };

export function mergeMissingDemoClients(
  loaded: Client[],
  demoClients: Client[]
): Client[] {
  const ids = new Set(loaded.map((c) => c.id));
  const missing = demoClients.filter((c) => !ids.has(c.id));
  if (missing.length === 0) return loaded;
  return [...loaded, ...missing];
}

export function parseStoredClients(
  raw: string | null,
  demoClients: Client[]
): Client[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Client[];
    return normalizeClients(mergeMissingDemoClients(parsed, demoClients));
  } catch {
    return null;
  }
}

export function loadPersistedClients(
  demoClients: Client[],
  readRaw: () => string | null = () =>
    typeof localStorage !== "undefined"
      ? localStorage.getItem(CLIENT_DEMO_STORAGE_KEY)
      : null
): Client[] {
  const fromStorage = parseStoredClients(readRaw(), demoClients);
  if (fromStorage) return fromStorage;
  return normalizeClients(demoClients);
}

export function persistClientList(
  clients: Client[],
  writeRaw: (json: string) => void = (json) => {
    localStorage.setItem(CLIENT_DEMO_STORAGE_KEY, json);
  }
): ClientListPersistResult {
  try {
    const json = JSON.stringify(clients);
    writeRaw(json);
    return { ok: true, clients };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save demo data to browser storage.";
    return { ok: false, error: message };
  }
}

/**
 * Apply a mutation starting from the latest persisted list (not in-memory stale state).
 */
export function mutatePersistedClientList(
  demoClients: Client[],
  updater: (base: Client[]) => Client[],
  readRaw: () => string | null,
  writeRaw: (json: string) => void
): ClientListPersistResult {
  const base = loadPersistedClients(demoClients, readRaw);
  const next = normalizeClients(
    mergeMissingDemoClients(updater(base), demoClients)
  );
  const saved = persistClientList(next, writeRaw);
  if (!saved.ok) return saved;
  return { ok: true, clients: next };
}

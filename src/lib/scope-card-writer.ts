import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  sanitizeClientIdForPath,
  scopeCardContentEquals,
  type ScopeCard,
} from "./scope-card";

const LIVE_CLIENTS_DIR = path.join(process.cwd(), "clients");
const DEMO_CLIENTS_DIR = path.join(process.cwd(), "clients", "demo");

export type ScopeCardWriteTarget = "live" | "demo";

export function assertFilesystemScopeExportAllowed(): void {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Filesystem scope-card export is only available in development.");
  }
}

function clientsDirForTarget(target: ScopeCardWriteTarget): string {
  return target === "demo" ? DEMO_CLIENTS_DIR : LIVE_CLIENTS_DIR;
}

async function readExistingCard(
  clientId: string,
  target: ScopeCardWriteTarget
): Promise<ScopeCard | null> {
  const safeId = sanitizeClientIdForPath(clientId);
  if (!safeId) return null;
  const filePath = path.join(clientsDirForTarget(target), `${safeId}.json`);
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as ScopeCard;
  } catch {
    return null;
  }
}

export interface WriteScopeCardResult {
  card: ScopeCard;
  created: boolean;
  versionChanged: boolean;
}

/** Resolve final card version from an incoming payload vs disk. */
export async function resolveScopeCardWrite(
  incoming: ScopeCard,
  target: ScopeCardWriteTarget = "live"
): Promise<WriteScopeCardResult> {
  assertFilesystemScopeExportAllowed();

  const safeId = sanitizeClientIdForPath(incoming.client_id);
  if (!safeId) {
    throw new Error("Invalid client id for scope-card export.");
  }

  const clientsDir = clientsDirForTarget(target);
  await mkdir(clientsDir, { recursive: true });
  const existing = await readExistingCard(safeId, target);
  const updatedAt = new Date().toISOString();

  if (existing && scopeCardContentEquals(incoming, existing)) {
    return { card: existing, created: false, versionChanged: false };
  }

  const version = existing ? existing.card_version + 1 : 1;
  const card: ScopeCard = { ...incoming, card_version: version, updated_at: updatedAt };
  const filePath = path.join(clientsDir, `${safeId}.json`);
  await writeFile(filePath, JSON.stringify(card, null, 2) + "\n", "utf8");

  return {
    card,
    created: !existing,
    versionChanged: true,
  };
}

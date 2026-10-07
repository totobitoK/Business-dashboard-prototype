import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  sanitizeClientIdForPath,
  scopeCardContentEquals,
  type ScopeCard,
} from "./scope-card";

const CLIENTS_DIR = path.join(process.cwd(), "clients");

async function readExistingCard(clientId: string): Promise<ScopeCard | null> {
  const safeId = sanitizeClientIdForPath(clientId);
  if (!safeId) return null;
  const filePath = path.join(CLIENTS_DIR, `${safeId}.json`);
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
  incoming: ScopeCard
): Promise<WriteScopeCardResult> {
  const safeId = sanitizeClientIdForPath(incoming.client_id);
  if (!safeId) {
    throw new Error("Invalid client id for scope-card export.");
  }

  await mkdir(CLIENTS_DIR, { recursive: true });
  const existing = await readExistingCard(safeId);
  const updatedAt = new Date().toISOString();

  if (existing && scopeCardContentEquals(incoming, existing)) {
    return { card: existing, created: false, versionChanged: false };
  }

  const version = existing ? existing.card_version + 1 : 1;
  const card: ScopeCard = { ...incoming, card_version: version, updated_at: updatedAt };
  const filePath = path.join(CLIENTS_DIR, `${safeId}.json`);
  await writeFile(filePath, JSON.stringify(card, null, 2) + "\n", "utf8");

  return {
    card,
    created: !existing,
    versionChanged: true,
  };
}

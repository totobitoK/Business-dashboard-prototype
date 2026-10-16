import fs from "fs";
import path from "path";

export type DevSeedCredentials = {
  generatedAt: string;
  users: Record<string, string>;
};

export function loadDevSeedCredentials(): DevSeedCredentials | null {
  const filePath = path.join(process.cwd(), ".dev-seed-credentials.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as DevSeedCredentials;
  } catch {
    return null;
  }
}

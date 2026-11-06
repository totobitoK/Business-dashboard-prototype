import crypto from "crypto";
import { getSquareCredentials } from "./config";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function encryptionKey(): Buffer {
  const credentials = getSquareCredentials();
  if (!credentials) {
    throw new Error("Square token encryption key is not configured for this environment.");
  }
  return crypto.createHash("sha256").update(credentials.encryptionKey).digest();
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptToken(payload: string): string {
  const buf = Buffer.from(payload, "base64url");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const data = buf.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv(ALGO, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

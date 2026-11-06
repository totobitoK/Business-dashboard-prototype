export const SIGNED_AGREEMENT_BUCKET = "signed-agreements";
export const MAX_SIGNED_AGREEMENT_BYTES = 20 * 1024 * 1024;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPdfBytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 5 || bytes.byteLength > MAX_SIGNED_AGREEMENT_BYTES) return false;
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

export function displayPdfFilename(raw: string): string | null {
  const base = raw.replace(/\\/g, "/").split("/").pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f]/g, "").trim();
  if (!cleaned || cleaned.length > 180) return null;
  if (cleaned === "." || cleaned === "..") return null;
  if (!cleaned.toLowerCase().endsWith(".pdf")) return null;
  return cleaned;
}

export function signedAgreementStoragePath(projectId: string, agreementId: string): string | null {
  if (!UUID.test(projectId) || !UUID.test(agreementId)) return null;
  return `${projectId}/${agreementId}.pdf`;
}

export function contentDisposition(kind: "inline" | "attachment", filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"`;
}

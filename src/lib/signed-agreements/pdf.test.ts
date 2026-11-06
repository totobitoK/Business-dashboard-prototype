import { describe, expect, it } from "vitest";
import {
  MAX_SIGNED_AGREEMENT_BYTES,
  contentDisposition,
  displayPdfFilename,
  isPdfBytes,
  signedAgreementStoragePath,
} from "./pdf";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

describe("signed agreement files", () => {
  it("accepts a PDF and rejects other bytes", () => {
    expect(isPdfBytes(PDF)).toBe(true);
    expect(isPdfBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(false);
    expect(isPdfBytes(new TextEncoder().encode("not a pdf"))).toBe(false);
    const oversized = new Uint8Array(MAX_SIGNED_AGREEMENT_BYTES + 1);
    oversized.set(PDF, 0);
    expect(isPdfBytes(oversized)).toBe(false);
  });

  it("keeps a safe PDF filename and drops a path", () => {
    expect(displayPdfFilename("Signed agreement.pdf")).toBe("Signed agreement.pdf");
    expect(displayPdfFilename("../secret/Agreement.PDF")).toBe("Agreement.PDF");
    expect(displayPdfFilename("notes.txt")).toBeNull();
    expect(displayPdfFilename("")).toBeNull();
  });

  it("builds a storage path from ids only", () => {
    const projectId = "11111111-1111-4111-8111-111111111111";
    const agreementId = "22222222-2222-4222-8222-222222222222";
    expect(signedAgreementStoragePath(projectId, agreementId)).toBe(
      `${projectId}/${agreementId}.pdf`
    );
    expect(signedAgreementStoragePath("../project", agreementId)).toBeNull();
  });

  it("sets a quoted download name", () => {
    expect(contentDisposition("attachment", 'Quote "name".pdf')).toBe(
      'attachment; filename="Quote _name_.pdf"'
    );
  });
});

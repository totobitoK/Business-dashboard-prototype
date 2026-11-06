"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { SignedAgreementRecord } from "@/lib/signed-agreements/access";

function formatUploadedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function AgreementLinks({ projectId, agreementId }: { projectId: string; agreementId: string }) {
  const base = `/api/admin/projects/${projectId}/signed-agreements/${agreementId}`;
  return (
    <div className="flex shrink-0 gap-3 text-sm">
      <a href={`${base}?disposition=inline`} target="_blank" rel="noopener noreferrer" className="font-medium text-purple hover:underline">
        Open
      </a>
      <a href={`${base}?disposition=attachment`} className="font-medium text-purple hover:underline">
        Download
      </a>
    </div>
  );
}

export function SignedAgreementSection({
  projectId,
  agreements,
}: {
  projectId: string;
  agreements: SignedAgreementRecord[];
}) {
  const router = useRouter();
  const pendingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const current = agreements.find((agreement) => agreement.is_current) ?? null;
  const previous = agreements.filter((agreement) => !agreement.is_current);

  async function upload(file: File | undefined) {
    if (!file || pendingRef.current) return;
    const namedPdf = file.name.toLowerCase().endsWith(".pdf");
    if (file.type && file.type !== "application/pdf" && !namedPdf) {
      setMessage("Choose a PDF.");
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setMessage(null);
    const body = new FormData();
    body.set("file", file);
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/signed-agreements`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        setMessage("The PDF was not received. Choose a PDF of 20 MB or less and try again.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("The PDF was not received. Choose a PDF of 20 MB or less and try again.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-purple-100 bg-white p-5 shadow-soft">
      <div>
        <h2 className="text-lg font-semibold text-ink">Signed agreement</h2>
        <p className="mt-1 text-sm text-ink-muted">
          After the agreement is signed outside RavenView, drop the signed PDF here. This records
          that the file was received. It does not check the signature, and it does not activate the
          customer or change scope, preview approval, or payment.
        </p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const files = [...event.dataTransfer.files];
          if (files.length !== 1) {
            setMessage("Choose one PDF.");
            return;
          }
          void upload(files[0]);
        }}
        className={`rounded-lg border border-dashed px-4 py-6 text-center ${
          dragging ? "border-purple bg-purple-50" : "border-purple-200 bg-purple-50/30"
        }`}
      >
        <p className="text-sm text-ink">Drag a signed PDF here, or choose a file.</p>
        <label className="mt-3 inline-block cursor-pointer rounded-lg border border-purple bg-white px-4 py-2 text-sm font-semibold text-purple hover:bg-purple-50">
          Choose PDF
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void upload(file);
            }}
          />
        </label>
        {pending ? <p className="mt-3 text-sm text-ink-muted">Receiving the PDF…</p> : null}
        {message ? <p className="mt-3 text-sm text-amber-900">{message}</p> : null}
      </div>

      {current ? (
        <div className="rounded-lg border border-purple-100 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple">Current copy</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words font-medium text-ink">{current.original_filename}</p>
              <p className="text-sm text-ink-muted">Received {formatUploadedAt(current.uploaded_at)}</p>
            </div>
            <AgreementLinks projectId={projectId} agreementId={current.id} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">No signed agreement has been received.</p>
      )}

      {previous.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-ink">Previous copies</h3>
          <p className="mt-1 text-sm text-ink-muted">
            These are older PDFs. The current copy is the latest one received.
          </p>
          <ul className="mt-2 divide-y divide-purple-50">
            {previous.map((agreement) => (
              <li key={agreement.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-ink">{agreement.original_filename}</p>
                  <p className="text-sm text-ink-muted">Received {formatUploadedAt(agreement.uploaded_at)}</p>
                </div>
                <AgreementLinks projectId={projectId} agreementId={agreement.id} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

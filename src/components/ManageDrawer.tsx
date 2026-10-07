"use client";

import { useEffect, useState } from "react";
import { CurrencyAmount } from "./CurrencyAmount";
import { AdminMilestones } from "./AdminMilestones";
import { ComingSoon } from "./ComingSoon";
import { OnboardingStepsDisplay } from "./OnboardingSteps";
import { StatusBadge } from "./StatusBadge";
import { useClientStore } from "@/lib/client-store";
import {
  canActivateClient,
  getOnboardingFormStatusLabel,
  getSetupRemaining,
  isScopePricingConfirmed,
} from "@/lib/onboarding";
import { formatToolsList } from "@/lib/metrics";
import { clientRoutes } from "@/lib/routes";
import {
  CONNECTION_STATUS_LABELS,
  getDepositAmount,
  isFinalBalancePaid,
} from "@/lib/client-milestones";
import { canAcceptScopeCard } from "@/lib/scope-card-export";
import type {
  ClientOnboardingSubmission,
  ClientStatus,
  ConnectionDemoStatus,
  OnboardingPath,
  PaymentType,
} from "@/lib/types";

interface ManageDrawerProps {
  clientId: string | null;
  onClose: () => void;
}

export function ManageDrawer({ clientId, onClose }: ManageDrawerProps) {
  const {
    clients,
    updateClient,
    setClientStatus,
    setOnboardingPath,
    toggleStep,
    addPayment,
    addNote,
    activateClient,
    acceptScopeCard,
    updateGuidedConnectionDemoStatus,
    setPaymentOnlyPrepConfirmed,
  } = useClientStore();

  const client = clients.find((c) => c.id === clientId) ?? null;
  const [noteText, setNoteText] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("setup");
  const [paymentNote, setPaymentNote] = useState("");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (clientId) {
      document.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [clientId, onClose]);

  if (!client) return null;

  const setupRemaining = getSetupRemaining(client);
  const depositDue = getDepositAmount(client);
  const canActivate = canActivateClient(client);

  function handleAddNote() {
    if (!noteText.trim()) return;
    addNote(client!.id, noteText.trim());
    setNoteText("");
  }

  function handleAddPayment() {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) return;
    addPayment(client!.id, amount, paymentType, paymentNote.trim() || undefined);
    setPaymentAmount("");
    setPaymentNote("");
  }

  async function handleAcceptScopeCard() {
    if (!client) return;
    setExporting(true);
    setExportMessage(null);
    const result = await acceptScopeCard(client.id);
    setExporting(false);
    if (result.ok) {
      if (result.unchanged) {
        setExportMessage("Scope card unchanged — no file update needed.");
      } else {
        setExportMessage(
          `Scope card exported to clients/${client.id}.json (v${result.card?.card_version}).`
        );
      }
    } else {
      setExportMessage(result.error ?? "Export failed.");
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 bg-navy/20"
        aria-label="Close manage panel"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-drawer-title"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-baby-200 bg-white shadow-card"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-baby-100 px-6 py-5">
          <div>
            <h2 id="manage-drawer-title" className="text-lg font-semibold text-navy">
              {client.company}
            </h2>
            <p className="mt-0.5 text-sm text-navy-muted">{client.contactName}</p>
            <div className="mt-2">
              <StatusBadge status={client.status} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-navy-muted transition-colors hover:bg-baby-50 hover:text-navy"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Status */}
          <Section title="Status">
            <select
              value={client.status}
              onChange={(e) =>
                setClientStatus(client.id, e.target.value as ClientStatus)
              }
              className={inputClass}
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            {client.status === "pending" && !canActivate && (
              <p className="mt-2 text-xs text-navy-muted">
                Complete onboarding and setup payment before activating.
              </p>
            )}
            {client.status === "active" && (
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={client.subscriptionActive}
                  onChange={(e) =>
                    updateClient(client.id, {
                      subscriptionActive: e.target.checked,
                    })
                  }
                  className="rounded border-baby-300 text-navy focus:ring-baby-400"
                />
                <span className="text-navy">Subscription active (counts toward MRR)</span>
              </label>
            )}
          </Section>

          {/* Contact */}
          <Section title="Contact & company">
            <div className="space-y-3">
              <EditableField
                label="Company"
                value={client.company}
                onChange={(v) => updateClient(client.id, { company: v })}
                disabled={client.status === "archived"}
              />
              <EditableField
                label="Contact"
                value={client.contactName}
                onChange={(v) => updateClient(client.id, { contactName: v })}
                disabled={client.status === "archived"}
              />
              <EditableField
                label="Email"
                value={client.email}
                onChange={(v) => updateClient(client.id, { email: v })}
                disabled={client.status === "archived"}
              />
              <EditableField
                label="Phone"
                value={client.phone}
                onChange={(v) => updateClient(client.id, { phone: v })}
                disabled={client.status === "archived"}
              />
              <EditableField
                label="Company website"
                value={client.website ?? ""}
                onChange={(v) =>
                  updateClient(client.id, { website: v.trim() || undefined })
                }
                disabled={client.status === "archived"}
                placeholder="https://example.com"
              />
            </div>
          </Section>

          {/* Project details */}
          <Section title="Project details">
            <div className="space-y-3">
              <EditableField
                label="Service / project name"
                value={client.serviceName ?? ""}
                onChange={(v) =>
                  updateClient(client.id, { serviceName: v.trim() || undefined })
                }
                disabled={client.status === "archived"}
              />
              <EditableTextarea
                label="Dashboard scope"
                value={client.dashboardScope ?? ""}
                onChange={(v) =>
                  updateClient(client.id, {
                    dashboardScope: v.trim() || undefined,
                  })
                }
                disabled={client.status === "archived"}
                rows={3}
              />
              <EditableField
                label="Data sources needed"
                value={client.dataSourcesNeeded ?? ""}
                onChange={(v) =>
                  updateClient(client.id, {
                    dataSourcesNeeded: v.trim() || undefined,
                  })
                }
                disabled={client.status === "archived"}
                placeholder="e.g. QuickBooks, Google Sheets, Google Calendar"
              />
              <EditableField
                label="Target launch date"
                value={client.targetLaunchDate ?? ""}
                type="date"
                onChange={(v) =>
                  updateClient(client.id, {
                    targetLaunchDate: v || undefined,
                  })
                }
                disabled={client.status === "archived"}
              />
            </div>
          </Section>

          {/* Pricing */}
          <Section title="Pricing">
            <div className="grid grid-cols-2 gap-3">
              <EditableField
                label="Setup fee (USD)"
                value={String(client.setupFee)}
                type="number"
                onChange={(v) =>
                  updateClient(client.id, { setupFee: Number(v) || 0 })
                }
                disabled={client.status === "archived"}
              />
              <EditableField
                label="Monthly fee (USD)"
                value={String(client.monthlyFee)}
                type="number"
                onChange={(v) =>
                  updateClient(client.id, { monthlyFee: Number(v) || 0 })
                }
                disabled={client.status === "archived"}
              />
            </div>
            {client.status === "pending" && setupRemaining > 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Deposit target (50%): <CurrencyAmount amount={depositDue} /> —
                remaining setup balance{" "}
                <CurrencyAmount amount={setupRemaining} />
              </p>
            )}
          </Section>

          <Section title="Agreed scope & guided setup">
            <EditableTextarea
              label="Agreed scope summary (client-facing after confirm)"
              value={client.agreedScopeSummary ?? ""}
              onChange={(v) =>
                updateClient(client.id, {
                  agreedScopeSummary: v.trim() || undefined,
                })
              }
              disabled={client.status === "archived"}
              rows={3}
            />
            <EditableTextarea
              label="Guided setup notes (internal only)"
              value={client.guidedSetupNotes ?? ""}
              onChange={(v) =>
                updateClient(client.id, {
                  guidedSetupNotes: v.trim() || undefined,
                })
              }
              disabled={client.status === "archived"}
              rows={2}
            />
            <EditableField
              label="Dashboard preview URL"
              value={client.dashboardPreviewUrl ?? ""}
              onChange={(v) =>
                updateClient(client.id, {
                  dashboardPreviewUrl: v.trim() || undefined,
                })
              }
              disabled={client.status === "archived"}
              placeholder="https://..."
            />
            {(client.guidedConnections?.length ?? 0) > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-navy-muted">
                  Simulated connection progress (demo)
                </p>
                {client.guidedConnections!.map((conn) => (
                  <label key={conn.id} className="block text-sm">
                    <span className="text-navy">{conn.label}</span>
                    <select
                      value={conn.demoStatus}
                      disabled={client.status === "archived"}
                      onChange={(e) =>
                        updateGuidedConnectionDemoStatus(
                          client.id,
                          conn.id,
                          e.target.value as ConnectionDemoStatus
                        )
                      }
                      className={inputClass + " mt-1"}
                    >
                      {(
                        Object.keys(CONNECTION_STATUS_LABELS) as ConnectionDemoStatus[]
                      ).map((key) => (
                        <option key={key} value={key}>
                          {CONNECTION_STATUS_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </Section>

          {/* Client onboarding preview & review */}
          <Section title="Client onboarding">
            {client.onboardingPath === "full" ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple">
                    Form: {getOnboardingFormStatusLabel(client)}
                  </span>
                  {client.onboardingSubmission?.submittedAt && (
                    <span className="text-xs text-navy-muted">
                      Submitted{" "}
                      {new Date(
                        client.onboardingSubmission.submittedAt
                      ).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <a
                  href={clientRoutes.onboarding(client.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-purple hover:text-purple-dark"
                >
                  Open client onboarding preview ↗
                </a>
                {client.onboardingSubmission && (
                  <ClientAnswersSummary submission={client.onboardingSubmission} />
                )}
                {isScopePricingConfirmed(client) && (
                  <p className="mt-2 text-xs text-emerald-700">
                    Scope card accepted
                    {client.scopePricingConfirmedAt &&
                      ` — ${new Date(client.scopePricingConfirmedAt).toLocaleDateString()}`}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-navy-muted">
                  Payment-only path — no self-service intake.
                </p>
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={client.paymentOnlyPrepConfirmed === true}
                    disabled={client.status === "archived"}
                    onChange={(e) =>
                      setPaymentOnlyPrepConfirmed(client.id, e.target.checked)
                    }
                    className="mt-0.5 rounded border-baby-300 text-navy focus:ring-baby-400"
                  />
                  <span className="text-navy">
                    Discovery and scope complete offline (required before
                    client sees deposit)
                  </span>
                </label>
              </>
            )}
            <a
              href={clientRoutes.onboarding(client.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-purple hover:text-purple-dark"
            >
              Open client onboarding ↗
            </a>
          </Section>

          <Section title="Scope card export">
            <p className="mb-3 text-xs text-navy-muted">
              Agent contract at{" "}
              <code className="text-navy">clients/{client.id}.json</code> —
              exported automatically after onboarding submit and whenever
              relevant fields change. Sources and screens must be confirmed
              here — not copied from client onboarding.
            </p>
            <div className="space-y-3">
              <EditableField
                label="Accepted sources in (comma-separated)"
                value={formatListForInput(client.acceptedSourcesIn)}
                onChange={(v) =>
                  updateClient(client.id, {
                    acceptedSourcesIn: parseListInput(v),
                  })
                }
                disabled={client.status === "archived"}
                placeholder="e.g. Google Sheets, CSV"
              />
              <EditableField
                label="Accepted screens (comma-separated)"
                value={formatListForInput(client.acceptedScreens)}
                onChange={(v) =>
                  updateClient(client.id, {
                    acceptedScreens: parseListInput(v),
                  })
                }
                disabled={client.status === "archived"}
                placeholder="e.g. Revenue overview, Pipeline"
              />
            </div>
            {client.scopeCardExportedAt && (
              <p className="mt-2 text-xs text-navy-muted">
                Last export: v{client.scopeCardVersion ?? 1} —{" "}
                {new Date(client.scopeCardExportedAt).toLocaleString()}
              </p>
            )}
            {exportMessage && (
              <p
                className={`mt-2 text-xs ${
                  exportMessage.includes("failed") ||
                  exportMessage.includes("before accepting")
                    ? "text-red-700"
                    : "text-emerald-700"
                }`}
              >
                {exportMessage}
              </p>
            )}
            {client.status !== "archived" && (
              <button
                type="button"
                onClick={handleAcceptScopeCard}
                disabled={
                  exporting ||
                  (!isScopePricingConfirmed(client) && !canAcceptScopeCard(client))
                }
                className={
                  primaryBtnClass +
                  " mt-3 w-full disabled:cursor-not-allowed disabled:opacity-50"
                }
              >
                {exporting
                  ? "Exporting…"
                  : isScopePricingConfirmed(client)
                    ? "Update scope card export"
                    : "Accept scope card"}
              </button>
            )}
            {!isScopePricingConfirmed(client) &&
              client.onboardingPath === "full" &&
              !canAcceptScopeCard(client) && (
                <p className="mt-2 text-xs text-navy-muted">
                  Client must submit onboarding before you can accept the scope
                  card.
                </p>
              )}
          </Section>

          <Section title="Onboarding milestones">
            {client.status === "pending" && (
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-medium text-navy-muted">
                  Path
                </span>
                <select
                  value={client.onboardingPath}
                  onChange={(e) =>
                    setOnboardingPath(
                      client.id,
                      e.target.value as OnboardingPath
                    )
                  }
                  className={inputClass}
                >
                  <option value="full">Full onboarding</option>
                  <option value="payment-only">Payment only</option>
                </select>
              </label>
            )}
            <AdminMilestones client={client} />
            <details className="mt-4 text-xs text-navy-muted">
              <summary className="cursor-pointer font-medium">
                Legacy step toggles (internal)
              </summary>
              <div className="mt-2 opacity-80">
                <OnboardingStepsDisplay
                  client={client}
                  interactive={client.status === "pending"}
                  onToggleStep={(step) => toggleStep(client.id, step)}
                />
              </div>
            </details>
          </Section>

          {/* Payments */}
          <Section title="Payment history">
            {client.payments.length === 0 ? (
              <p className="text-sm text-navy-muted">No payments recorded.</p>
            ) : (
              <ul className="divide-y divide-baby-100 rounded-lg border border-baby-200">
                {client.payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2.5 text-sm"
                  >
                    <div>
                      <span className="font-medium capitalize text-navy">
                        {p.type}
                      </span>
                      {p.note && (
                        <span className="ml-2 text-xs text-navy-muted">
                          {p.note}
                        </span>
                      )}
                      <p className="text-xs text-navy-muted">
                        {new Date(p.date).toLocaleDateString()}
                      </p>
                    </div>
                    <CurrencyAmount
                      amount={p.amount}
                      detailed
                      prefix={p.type === "refund" ? "−" : ""}
                    />
                  </li>
                ))}
              </ul>
            )}

            {client.status !== "archived" && (
              <div className="mt-3 space-y-2 rounded-lg border border-baby-200 bg-baby-50/50 p-3">
                <p className="text-xs font-medium text-navy-muted">
                  Record manual payment (demo — not live checkout)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className={inputClass}
                  />
                  <select
                    value={paymentType}
                    onChange={(e) =>
                      setPaymentType(e.target.value as PaymentType)
                    }
                    className={inputClass}
                  >
                    <option value="setup">Setup</option>
                    <option value="subscription">Subscription</option>
                    <option value="refund">Refund</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={handleAddPayment}
                  className={secondaryBtnClass + " w-full"}
                >
                  Add payment
                </button>
              </div>
            )}
          </Section>

          {/* Notes */}
          <Section title="Notes">
            {client.notes.length === 0 ? (
              <p className="text-sm text-navy-muted">No notes yet.</p>
            ) : (
              <ul className="space-y-2">
                {client.notes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-lg border border-baby-200 bg-baby-50/30 px-3 py-2"
                  >
                    <p className="text-sm text-navy">{n.content}</p>
                    <p className="mt-1 text-xs text-navy-muted">
                      {new Date(n.date).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Add a note…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                className={inputClass + " flex-1"}
              />
              <button
                type="button"
                onClick={handleAddNote}
                disabled={!noteText.trim()}
                className={secondaryBtnClass + " shrink-0 disabled:opacity-50"}
              >
                Add
              </button>
            </div>
          </Section>

          {/* Dashboard & files — status-driven */}
          <Section title="Dashboard & files">
            {client.status === "active" && (
              <EditableField
                label="Dashboard URL"
                value={client.dashboardUrl ?? ""}
                onChange={(v) =>
                  updateClient(client.id, {
                    dashboardUrl: v || undefined,
                  })
                }
                placeholder="https://dashboard.example.com/..."
              />
            )}
            {client.status === "active" && client.dashboardUrl && (
              <a
                href={client.dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-navy-light hover:underline"
              >
                Open live dashboard ↗
              </a>
            )}
            {client.status === "pending" && (
              <p className="text-sm text-navy-muted">
                Dashboard link available once client is active.
              </p>
            )}
            {client.status === "archived" && client.dashboardUrl && (
              <p className="text-sm text-navy-muted line-through">
                {client.dashboardUrl}
              </p>
            )}

            <div className="mt-4">
              {client.files.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {client.files.map((f) => (
                    <li
                      key={f.id}
                      className="text-sm text-navy-muted"
                    >
                      {f.name}{" "}
                      <span className="text-xs">({f.type})</span>
                    </li>
                  ))}
                </ul>
              )}
              <ComingSoon
                label="Upload reference files"
                description="File uploads will be available when backend storage is connected."
              />
            </div>
          </Section>
        </div>

        {/* Footer actions — status-driven */}
        <div className="border-t border-baby-100 px-6 py-4">
          {client.status === "pending" && (
            <button
              type="button"
              onClick={() => activateClient(client.id)}
              disabled={!canActivate}
              className={
                primaryBtnClass +
                " w-full disabled:cursor-not-allowed disabled:opacity-50"
              }
            >
              {canActivate
                ? "Activate client"
                : !isFinalBalancePaid(client)
                  ? "Activate client — final setup balance unpaid"
                  : "Activate client — complete guided setup, build, and review"}
            </button>
          )}
          {client.status === "active" && (
            <button
              type="button"
              onClick={() => setClientStatus(client.id, "archived")}
              className={
                secondaryBtnClass +
                " w-full border-amber-200 text-amber-800 hover:bg-amber-50"
              }
            >
              Archive client
            </button>
          )}
          {client.status === "archived" && (
            <button
              type="button"
              onClick={() => setClientStatus(client.id, "active")}
              className={primaryBtnClass + " w-full"}
            >
              Reactivate client
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

function formatListForInput(values?: string[]): string {
  return values?.join(", ") ?? "";
}

function parseListInput(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ClientAnswersSummary({
  submission,
}: {
  submission: ClientOnboardingSubmission;
}) {
  return (
    <div className="mt-4 space-y-3 rounded-lg border border-baby-200 bg-baby-50/30 p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-navy-muted">
        Client answers
      </p>
      <div>
        <p className="text-xs text-navy-muted">Business</p>
        <p className="text-navy">{submission.businessDescription}</p>
      </div>
      <div>
        <p className="text-xs text-navy-muted">Dashboard goals</p>
        <p className="text-navy">{submission.dashboardGoals}</p>
      </div>
      {submission.reportingPainPoints && (
        <div>
          <p className="text-xs text-navy-muted">Reporting pain points</p>
          <p className="text-navy">{submission.reportingPainPoints}</p>
        </div>
      )}
      {submission.dashboardUsers && (
        <div>
          <p className="text-xs text-navy-muted">Dashboard users</p>
          <p className="text-navy">{submission.dashboardUsers}</p>
        </div>
      )}
      <div>
        <p className="text-xs text-navy-muted">Tools</p>
        <p className="text-navy">
          {formatToolsList(submission.selectedTools)}
          {submission.otherToolExplanation &&
            ` — ${submission.otherToolExplanation}`}
        </p>
        {submission.toolsNotes && (
          <p className="mt-1 text-xs text-navy-muted">{submission.toolsNotes}</p>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-navy-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function EditableField({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-navy-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={
          inputClass + (disabled ? " cursor-not-allowed opacity-60" : "")
        }
      />
    </label>
  );
}

function EditableTextarea({
  label,
  value,
  onChange,
  disabled = false,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-navy-muted">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        className={
          inputClass +
          " resize-y" +
          (disabled ? " cursor-not-allowed opacity-60" : "")
        }
      />
    </label>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

const inputClass =
  "w-full rounded-lg border border-baby-200 bg-white px-3 py-2 text-sm text-navy placeholder:text-navy-muted/50 focus:border-baby-400 focus:outline-none focus:ring-1 focus:ring-baby-400";

const primaryBtnClass =
  "rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-baby-400";

const secondaryBtnClass =
  "rounded-lg border border-baby-200 bg-white px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-baby-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-baby-400";

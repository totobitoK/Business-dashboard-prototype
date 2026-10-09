"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { AdminMilestones } from "@/components/AdminMilestones";
import { ComingSoon } from "@/components/ComingSoon";
import { OnboardingStepsDisplay } from "@/components/OnboardingSteps";
import { ManageDrawerAccordion } from "@/components/admin/ManageDrawerAccordion";
import { ManageEditableGroup } from "@/components/admin/ManageEditableGroup";
import {
  getDefaultOpenManageDrawerSections,
  type ManageDrawerSectionId,
} from "@/lib/admin-client-drawer";
import { getActivationEligibility } from "@/lib/client-activation";
import {
  CONNECTION_STATUS_LABELS,
  getDepositAmount,
  getMilestoneProgress,
  isMilestoneComplete,
} from "@/lib/client-milestones";
import { buildCustomerPortalPreviewUrl } from "@/lib/customer-portal-context";
import { getWorkspaceForClientId } from "@/lib/customer-workspaces";
import { parseFee, validateFee, validateRequired } from "@/lib/form-validation";
import { formatToolsList } from "@/lib/metrics";
import {
  getOnboardingFormStatusLabel,
  getSetupRemaining,
  isScopePricingConfirmed,
} from "@/lib/onboarding";
import {
  parseOfflinePaymentAmount,
  todayDateInputValue,
} from "@/lib/offline-payment-input";
import { formatPaymentRecordSource } from "@/lib/payment-record-source";
import { clientRoutes } from "@/lib/routes";
import { canAcceptScopeCard } from "@/lib/scope-card-export";
import { useClientStore } from "@/lib/client-store";
import type {
  Client,
  ClientOnboardingSubmission,
  ClientStatus,
  ConnectionDemoStatus,
  OnboardingPath,
  PaymentType,
} from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-baby-200 bg-white px-3 py-2 text-sm text-navy placeholder:text-navy-muted/50 focus:border-baby-400 focus:outline-none focus:ring-1 focus:ring-baby-400";

const primaryBtnClass =
  "rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-light";

const secondaryBtnClass =
  "rounded-lg border border-baby-200 bg-white px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-baby-50";

type EditGroup = "company" | "project" | "pricing" | null;

export function ManageDrawerBody({ client }: { client: Client }) {
  const store = useClientStore();
  const archived = client.status === "archived";
  const portalWorkspace = getWorkspaceForClientId(client.id);
  const activation = getActivationEligibility(client);

  const [openSections, setOpenSections] = useState<Set<ManageDrawerSectionId>>(
    () => getDefaultOpenManageDrawerSections(client)
  );
  const [editGroup, setEditGroup] = useState<EditGroup>(null);
  const [showOfflinePayment, setShowOfflinePayment] = useState(false);

  const [noteText, setNoteText] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("setup");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayDateInputValue());
  const [paymentMethodRef, setPaymentMethodRef] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [companyDraft, setCompanyDraft] = useState(() => companySeed(client));
  const [projectDraft, setProjectDraft] = useState(() => projectSeed(client));
  const [pricingDraft, setPricingDraft] = useState(() => pricingSeed(client));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOpenSections(getDefaultOpenManageDrawerSections(client));
    setEditGroup(null);
    setShowOfflinePayment(false);
    setNoteText("");
    setPaymentAmount("");
    setPaymentMessage(null);
    setPaymentDate(todayDateInputValue());
    setPaymentMethodRef("");
    setExportMessage(null);
    setCompanyDraft(companySeed(client));
    setProjectDraft(projectSeed(client));
    setPricingDraft(pricingSeed(client));
    setSaveError(null);
    // Reset drawer UI only when switching clients — not on every field sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- client.id
  }, [client.id]);

  const toggleSection = useCallback(
    (id: ManageDrawerSectionId) => {
      if (editGroup) return;
      setOpenSections((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [editGroup]
  );

  const ensureSectionOpen = (id: ManageDrawerSectionId) => {
    setOpenSections((prev) => new Set(prev).add(id));
  };

  const milestoneSummary = useMemo(() => {
    const { completed, total } = getMilestoneProgress(client);
    return `${completed}/${total} milestones complete`;
  }, [client]);

  const scopeSummary = isScopePricingConfirmed(client)
    ? `Scope confirmed · ${client.acceptedSourcesIn?.length ?? 0} sources`
    : "Scope not confirmed";

  function handleAddNote() {
    if (!noteText.trim()) return;
    store.addNote(client.id, noteText.trim());
    setNoteText("");
  }

  function handleAddPayment() {
    if (paymentSaving) return;
    setPaymentMessage(null);
    const parsed = parseOfflinePaymentAmount(paymentAmount);
    if (!parsed.ok) {
      setPaymentMessage({ type: "error", text: parsed.error });
      ensureSectionOpen("billing");
      return;
    }
    setPaymentSaving(true);
    const result = store.addPayment(client.id, parsed.amount, paymentType, {
      note: paymentNote.trim() || undefined,
      dateReceived: paymentDate || todayDateInputValue(),
      methodReference: paymentMethodRef.trim() || undefined,
    });
    setPaymentSaving(false);
    if (!result.ok) {
      setPaymentMessage({
        type: "error",
        text: result.error ?? "Could not save payment to browser storage.",
      });
      return;
    }
    setPaymentMessage({
      type: "success",
      text: "Offline payment recorded and saved locally.",
    });
    setPaymentAmount("");
    setPaymentNote("");
    setPaymentMethodRef("");
    setPaymentDate(todayDateInputValue());
  }

  async function handleAcceptScopeCard() {
    setExporting(true);
    setExportMessage(null);
    const result = await store.acceptScopeCard(client.id);
    setExporting(false);
    if (result.ok) {
      setExportMessage(
        result.unchanged
          ? "Scope card unchanged — no file update needed."
          : `Scope card exported (v${result.card?.card_version}).`
      );
    } else {
      setExportMessage(result.error ?? "Export failed.");
    }
  }

  function saveCompany() {
    setSaveError(null);
    const errors = [
      validateRequired(companyDraft.company, "Company"),
      validateRequired(companyDraft.contactName, "Contact"),
      validateRequired(companyDraft.email, "Email"),
    ].filter(Boolean);
    if (errors.length) {
      setSaveError(errors[0]!);
      ensureSectionOpen("company-contact");
      return;
    }
    setSaving(true);
    const result = store.updateClient(client.id, {
      company: companyDraft.company.trim(),
      contactName: companyDraft.contactName.trim(),
      email: companyDraft.email.trim(),
      phone: companyDraft.phone.trim(),
      website: companyDraft.website.trim() || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error ?? "Could not save changes.");
      return;
    }
    setEditGroup(null);
  }

  function saveProject() {
    setSaveError(null);
    setSaving(true);
    const result = store.updateClient(client.id, {
      serviceName: projectDraft.serviceName.trim() || undefined,
      dashboardScope: projectDraft.dashboardScope.trim() || undefined,
      dataSourcesNeeded: projectDraft.dataSourcesNeeded.trim() || undefined,
      targetLaunchDate: projectDraft.targetLaunchDate || undefined,
      agreedScopeSummary: projectDraft.agreedScopeSummary.trim() || undefined,
      acceptedSourcesIn: parseListInput(projectDraft.acceptedSourcesIn),
      acceptedScreens: parseListInput(projectDraft.acceptedScreens),
    });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error ?? "Could not save changes.");
      ensureSectionOpen("scope-requirements");
      return;
    }
    setEditGroup(null);
  }

  function savePricing() {
    setSaveError(null);
    const setupErr = validateFee(pricingDraft.setupFee, "Setup fee");
    const monthlyErr = validateFee(pricingDraft.monthlyFee, "Monthly fee");
    if (setupErr || monthlyErr) {
      setSaveError(setupErr ?? monthlyErr!);
      ensureSectionOpen("billing");
      return;
    }
    setSaving(true);
    const result = store.updateClient(client.id, {
      setupFee: parseFee(pricingDraft.setupFee),
      monthlyFee: parseFee(pricingDraft.monthlyFee),
    });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error ?? "Could not save changes.");
      return;
    }
    setEditGroup(null);
  }

  const setupRemaining = getSetupRemaining(client);
  const depositDue = getDepositAmount(client);

  const sectionOpen = (id: ManageDrawerSectionId) => openSections.has(id);
  const sectionLocked = (id: ManageDrawerSectionId) =>
    (editGroup === "company" && id === "company-contact") ||
    (editGroup === "project" && id === "scope-requirements") ||
    (editGroup === "pricing" && id === "billing");

  return (
    <div className="space-y-3">
      <ManageDrawerAccordion
        title="Project progress"
        summary={milestoneSummary}
        open={sectionOpen("project-progress") || sectionLocked("project-progress")}
        lockOpen={sectionLocked("project-progress")}
        onToggle={() => toggleSection("project-progress")}
      >
        <label className="block text-sm">
          <span className="text-xs font-medium text-navy-muted">Client status</span>
          <select
            value={client.status}
            onChange={(e) =>
              store.setClientStatus(client.id, e.target.value as ClientStatus)
            }
            className={inputClass + " mt-1"}
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        {(client.status === "pending" ||
          (client.status === "archived" && !client.launchedAt)) &&
          !activation.canActivate && (
            <p className="mt-2 text-xs text-amber-950">
              Activation blocked — see launch blockers in overview.
            </p>
          )}
        {client.status === "active" && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={client.subscriptionActive}
              onChange={(e) =>
                store.updateClient(client.id, {
                  subscriptionActive: e.target.checked,
                })
              }
              className="rounded border-baby-300"
            />
            Subscription active (MRR)
          </label>
        )}

        {client.status === "pending" && (
          <label className="mt-4 block">
            <span className="text-xs font-medium text-navy-muted">Onboarding path</span>
            <select
              value={client.onboardingPath}
              onChange={(e) =>
                store.setOnboardingPath(client.id, e.target.value as OnboardingPath)
              }
              className={inputClass + " mt-1"}
            >
              <option value="full">Full onboarding</option>
              <option value="payment-only">Payment only</option>
            </select>
          </label>
        )}

        <div className="mt-4">
          <AdminMilestones client={client} />
        </div>

        {(client.guidedConnections?.length ?? 0) > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-navy-muted">Guided connections (demo)</p>
            {client.guidedConnections!.map((conn) => (
              <label key={conn.id} className="block text-sm">
                <span className="text-navy">{conn.label}</span>
                <select
                  value={conn.demoStatus}
                  disabled={archived}
                  onChange={(e) =>
                    store.updateGuidedConnectionDemoStatus(
                      client.id,
                      conn.id,
                      e.target.value as ConnectionDemoStatus
                    )
                  }
                  className={inputClass + " mt-1"}
                >
                  {(Object.keys(CONNECTION_STATUS_LABELS) as ConnectionDemoStatus[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {CONNECTION_STATUS_LABELS[key]}
                      </option>
                    )
                  )}
                </select>
              </label>
            ))}
          </div>
        )}

        {isMilestoneComplete(client, "building") && client.status === "pending" && (
          <div className="mt-4 rounded-lg border border-baby-200 bg-baby-50/50 p-3">
            <p className="text-xs font-semibold text-navy">Build & preview review</p>
            <button
              type="button"
              onClick={() => store.markPreviewReadyForReview(client.id)}
              className="mt-2 rounded-lg border border-purple bg-white px-3 py-1.5 text-xs font-semibold text-purple hover:bg-purple-50"
            >
              Mark revised preview ready for review
            </button>
          </div>
        )}

        <div className="mt-4">
          <p className="text-xs font-medium text-navy-muted">Onboarding submission</p>
          {client.onboardingPath === "full" ? (
            <>
              <p className="mt-1 text-sm text-navy">
                Form: {getOnboardingFormStatusLabel(client)}
              </p>
              <a
                href={clientRoutes.onboarding(client.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm font-medium text-purple"
              >
                Open onboarding preview ↗
              </a>
            </>
          ) : (
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={client.paymentOnlyPrepConfirmed === true}
                disabled={archived}
                onChange={(e) =>
                  store.setPaymentOnlyPrepConfirmed(client.id, e.target.checked)
                }
              />
              Discovery and scope complete offline
            </label>
          )}
          {portalWorkspace && (
            <a
              href={buildCustomerPortalPreviewUrl(portalWorkspace.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-sm font-medium text-purple"
            >
              Customer portal preview ↗
            </a>
          )}
        </div>

        <details className="mt-4 text-xs text-navy-muted">
          <summary className="cursor-pointer font-medium">Legacy step toggles</summary>
          <div className="mt-2">
            <OnboardingStepsDisplay
              client={client}
              interactive={client.status === "pending"}
              onToggleStep={(step) => store.toggleStep(client.id, step)}
            />
          </div>
        </details>
      </ManageDrawerAccordion>

      <ManageDrawerAccordion
        title="Scope & requirements"
        summary={scopeSummary}
        open={sectionOpen("scope-requirements") || sectionLocked("scope-requirements")}
        lockOpen={sectionLocked("scope-requirements")}
        onToggle={() => toggleSection("scope-requirements")}
      >
        <ManageEditableGroup
          editing={editGroup === "project"}
          disabled={archived}
          onEdit={() => {
            setProjectDraft(projectSeed(client));
            setEditGroup("project");
            ensureSectionOpen("scope-requirements");
          }}
          onCancel={() => {
            setProjectDraft(projectSeed(client));
            setEditGroup(null);
            setSaveError(null);
          }}
          onSave={saveProject}
          saveError={editGroup === "project" ? saveError : null}
          saving={saving}
          summary={
            <dl className="space-y-1">
              <div>
                <dt className="text-xs text-navy-muted">Service</dt>
                <dd>{client.serviceName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-navy-muted">Dashboard scope</dt>
                <dd className="whitespace-pre-wrap">
                  {client.dashboardScope ?? "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-navy-muted">Agreed scope</dt>
                <dd className="whitespace-pre-wrap">
                  {client.agreedScopeSummary ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-navy-muted">Sources</dt>
                <dd>{formatListForInput(client.acceptedSourcesIn) || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-navy-muted">Screens</dt>
                <dd>{formatListForInput(client.acceptedScreens) || "—"}</dd>
              </div>
            </dl>
          }
        >
          <Field label="Service / project name" value={projectDraft.serviceName} onChange={(v) => setProjectDraft((d) => ({ ...d, serviceName: v }))} />
          <TextArea label="Dashboard scope" value={projectDraft.dashboardScope} onChange={(v) => setProjectDraft((d) => ({ ...d, dashboardScope: v }))} />
          <Field label="Data sources needed" value={projectDraft.dataSourcesNeeded} onChange={(v) => setProjectDraft((d) => ({ ...d, dataSourcesNeeded: v }))} />
          <Field label="Target launch" type="date" value={projectDraft.targetLaunchDate} onChange={(v) => setProjectDraft((d) => ({ ...d, targetLaunchDate: v }))} />
          <TextArea label="Agreed scope summary" value={projectDraft.agreedScopeSummary} onChange={(v) => setProjectDraft((d) => ({ ...d, agreedScopeSummary: v }))} />
          <Field label="Accepted sources (comma-separated)" value={projectDraft.acceptedSourcesIn} onChange={(v) => setProjectDraft((d) => ({ ...d, acceptedSourcesIn: v }))} />
          <Field label="Accepted screens (comma-separated)" value={projectDraft.acceptedScreens} onChange={(v) => setProjectDraft((d) => ({ ...d, acceptedScreens: v }))} />
        </ManageEditableGroup>

        {client.onboardingSubmission && (
          <ClientAnswersSummary submission={client.onboardingSubmission} />
        )}

        <p className="mt-4 text-xs text-navy-muted">
          Scope card: clients/{client.id}.json
        </p>
        {exportMessage && (
          <p className="mt-1 text-xs text-navy">{exportMessage}</p>
        )}
        {!archived && (
          <button
            type="button"
            onClick={handleAcceptScopeCard}
            disabled={exporting || (!isScopePricingConfirmed(client) && !canAcceptScopeCard(client))}
            className={primaryBtnClass + " mt-2 w-full disabled:opacity-50"}
          >
            {exporting
              ? "Exporting…"
              : isScopePricingConfirmed(client)
                ? "Update scope card export"
                : "Accept scope card"}
          </button>
        )}

        <Field
          label="Guided setup notes (internal)"
          value={client.guidedSetupNotes ?? ""}
          disabled={archived}
          onChange={(v) =>
            store.updateClient(client.id, { guidedSetupNotes: v.trim() || undefined })
          }
        />
        <Field
          label="Dashboard preview URL"
          value={client.dashboardPreviewUrl ?? ""}
          disabled={archived}
          onChange={(v) =>
            store.updateClient(client.id, {
              dashboardPreviewUrl: v.trim() || undefined,
            })
          }
        />
      </ManageDrawerAccordion>

      <ManageDrawerAccordion
        title="Company & contact"
        summary={`${client.email}${client.phone ? ` · ${client.phone}` : ""}`}
        open={sectionOpen("company-contact") || sectionLocked("company-contact")}
        lockOpen={sectionLocked("company-contact")}
        onToggle={() => toggleSection("company-contact")}
      >
        <ManageEditableGroup
          editing={editGroup === "company"}
          disabled={archived}
          onEdit={() => {
            setCompanyDraft(companySeed(client));
            setEditGroup("company");
            ensureSectionOpen("company-contact");
          }}
          onCancel={() => {
            setCompanyDraft(companySeed(client));
            setEditGroup(null);
            setSaveError(null);
          }}
          onSave={saveCompany}
          saveError={editGroup === "company" ? saveError : null}
          saving={saving}
          summary={
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-navy-muted">Company</dt>
                <dd>{client.company}</dd>
              </div>
              <div>
                <dt className="text-xs text-navy-muted">Contact</dt>
                <dd>{client.contactName}</dd>
              </div>
              <div>
                <dt className="text-xs text-navy-muted">Email</dt>
                <dd>{client.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-navy-muted">Phone</dt>
                <dd>{client.phone || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-navy-muted">Website</dt>
                <dd>{client.website ?? "—"}</dd>
              </div>
            </dl>
          }
        >
          <Field label="Company" value={companyDraft.company} onChange={(v) => setCompanyDraft((d) => ({ ...d, company: v }))} />
          <Field label="Contact" value={companyDraft.contactName} onChange={(v) => setCompanyDraft((d) => ({ ...d, contactName: v }))} />
          <Field label="Email" value={companyDraft.email} onChange={(v) => setCompanyDraft((d) => ({ ...d, email: v }))} />
          <Field label="Phone" value={companyDraft.phone} onChange={(v) => setCompanyDraft((d) => ({ ...d, phone: v }))} />
          <Field label="Website" value={companyDraft.website} onChange={(v) => setCompanyDraft((d) => ({ ...d, website: v }))} />
        </ManageEditableGroup>
      </ManageDrawerAccordion>

      <ManageDrawerAccordion
        title="Billing"
        summary={`Paid ${client.setupPaidAmount} · Remaining ${setupRemaining}`}
        open={sectionOpen("billing") || sectionLocked("billing")}
        lockOpen={sectionLocked("billing")}
        onToggle={() => toggleSection("billing")}
      >
        <ManageEditableGroup
          editing={editGroup === "pricing"}
          disabled={archived}
          editLabel="Edit pricing"
          onEdit={() => {
            setPricingDraft(pricingSeed(client));
            setEditGroup("pricing");
            ensureSectionOpen("billing");
          }}
          onCancel={() => {
            setPricingDraft(pricingSeed(client));
            setEditGroup(null);
            setSaveError(null);
          }}
          onSave={savePricing}
          saveError={editGroup === "pricing" ? saveError : null}
          saving={saving}
          summary={
            <p>
              Setup <CurrencyAmount amount={client.setupFee} /> · Monthly{" "}
              <CurrencyAmount amount={client.monthlyFee} />
              {client.status === "pending" && setupRemaining > 0 && (
                <span className="block text-xs text-navy-muted mt-1">
                  Deposit target (50%): <CurrencyAmount amount={depositDue} />
                </span>
              )}
            </p>
          }
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="Setup fee (USD)" value={pricingDraft.setupFee} onChange={(v) => setPricingDraft((d) => ({ ...d, setupFee: v }))} />
            <Field label="Monthly fee (USD)" value={pricingDraft.monthlyFee} onChange={(v) => setPricingDraft((d) => ({ ...d, monthlyFee: v }))} />
          </div>
        </ManageEditableGroup>

        {client.payments.length === 0 ? (
          <p className="mt-3 text-sm text-navy-muted">No payments recorded.</p>
        ) : (
          <ul className="mt-3 divide-y divide-baby-100 rounded-lg border border-baby-200">
            {client.payments.map((p) => (
              <li key={p.id} className="flex justify-between px-3 py-2 text-sm">
                <div>
                  <span className="font-medium capitalize">{p.type}</span>
                  <span className="ml-2 text-xs text-navy-muted">
                    {formatPaymentRecordSource(p.recordSource)}
                  </span>
                  <p className="text-xs text-navy-muted">
                    {new Date(p.date).toLocaleDateString()}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <CurrencyAmount amount={p.amount} prefix={p.type === "refund" ? "−" : ""} />
              </li>
            ))}
          </ul>
        )}

        {!archived && !showOfflinePayment && (
          <button
            type="button"
            onClick={() => {
              setShowOfflinePayment(true);
              ensureSectionOpen("billing");
            }}
            className={secondaryBtnClass + " mt-3 w-full"}
          >
            Record offline payment
          </button>
        )}

        {!archived && showOfflinePayment && (
          <div className="mt-3 space-y-2 rounded-lg border border-baby-200 bg-baby-50/50 p-3">
            <p className="text-sm font-semibold text-navy">Record offline payment</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Amount (USD)" value={paymentAmount} onChange={setPaymentAmount} />
              <label className="block text-xs text-navy-muted">
                Type
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                  className={inputClass + " mt-0.5"}
                >
                  <option value="setup">Setup</option>
                  <option value="subscription">Subscription</option>
                  <option value="refund">Refund</option>
                </select>
              </label>
              <Field label="Date received" type="date" value={paymentDate} onChange={setPaymentDate} />
              <Field label="Reference" value={paymentMethodRef} onChange={setPaymentMethodRef} />
            </div>
            <Field label="Note" value={paymentNote} onChange={setPaymentNote} />
            {paymentMessage && (
              <p
                className={`text-xs ${paymentMessage.type === "error" ? "text-red-700" : "text-emerald-800"}`}
                role={paymentMessage.type === "error" ? "alert" : "status"}
              >
                {paymentMessage.text}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddPayment}
                disabled={paymentSaving}
                className={secondaryBtnClass + " flex-1 disabled:opacity-50"}
              >
                {paymentSaving ? "Saving…" : "Save payment"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOfflinePayment(false);
                  setPaymentMessage(null);
                }}
                className={secondaryBtnClass + " flex-1"}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </ManageDrawerAccordion>

      <ManageDrawerAccordion
        title="Notes & files"
        summary={`${client.notes.length} notes`}
        open={sectionOpen("notes-files")}
        onToggle={() => toggleSection("notes-files")}
      >
        {client.notes.length === 0 ? (
          <p className="text-sm text-navy-muted">No notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {client.notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-baby-200 px-3 py-2 text-sm">
                {n.content}
                <p className="text-xs text-navy-muted">
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

        {client.status === "active" && (
          <>
            <Field
              label="Dashboard URL"
              value={client.dashboardUrl ?? ""}
              onChange={(v) =>
                store.updateClient(client.id, { dashboardUrl: v || undefined })
              }
            />
            {client.dashboardUrl && (
              <a
                href={client.dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-navy-light"
              >
                Open live dashboard ↗
              </a>
            )}
          </>
        )}

        <div className="mt-4">
          {client.files.length > 0 && (
            <ul className="mb-2 text-sm text-navy-muted">
              {client.files.map((f) => (
                <li key={f.id}>
                  {f.name} ({f.type})
                </li>
              ))}
            </ul>
          )}
          <ComingSoon
            label="Upload reference files"
            description="File uploads when backend storage is connected."
          />
        </div>
      </ManageDrawerAccordion>
    </div>
  );
}

function companySeed(client: Client) {
  return {
    company: client.company,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone,
    website: client.website ?? "",
  };
}

function projectSeed(client: Client) {
  return {
    serviceName: client.serviceName ?? "",
    dashboardScope: client.dashboardScope ?? "",
    dataSourcesNeeded: client.dataSourcesNeeded ?? "",
    targetLaunchDate: client.targetLaunchDate ?? "",
    agreedScopeSummary: client.agreedScopeSummary ?? "",
    acceptedSourcesIn: formatListForInput(client.acceptedSourcesIn),
    acceptedScreens: formatListForInput(client.acceptedScreens),
  };
}

function pricingSeed(client: Client) {
  return {
    setupFee: String(client.setupFee),
    monthlyFee: String(client.monthlyFee),
  };
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="mt-2 block text-xs text-navy-muted">
      {label}
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass + " mt-0.5" + (disabled ? " opacity-60" : "")}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="mt-2 block text-xs text-navy-muted">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className={inputClass + " mt-0.5 resize-y"}
      />
    </label>
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
    <div className="mt-4 space-y-2 rounded-lg border border-baby-200 bg-baby-50/30 p-3 text-sm">
      <p className="text-xs font-semibold uppercase text-navy-muted">Client answers</p>
      <p>{submission.businessDescription}</p>
      <p className="text-xs text-navy-muted">Tools: {formatToolsList(submission.selectedTools)}</p>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DATA_SOURCE_TOOLS,
  mergeDraftWithClient,
  toFullAnswers,
  validateStep1,
  validateStep2,
  validateStep3,
} from "@/lib/onboarding-form";
import { useClientStore } from "@/lib/client-store";
import { formatToolsList } from "@/lib/metrics";
import type { Client, ClientOnboardingAnswers, DataSourceTool } from "@/lib/types";

const STEP_LABELS = ["Business details", "Your dashboard", "Current tools"];

export function ClientOnboardingForm({
  client,
  embedded = false,
}: {
  client: Client;
  embedded?: boolean;
}) {
  const { saveOnboardingDraft, submitOnboarding } = useClientStore();
  const initialAnswers = useMemo(
    () => mergeDraftWithClient(client, client.onboardingDraft),
    [client]
  );

  const [step, setStep] = useState<1 | 2 | 3 | "review">(
    client.onboardingDraft?.currentStep ?? 1
  );
  const [answers, setAnswers] =
    useState<Partial<ClientOnboardingAnswers>>(initialAnswers);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(
    client.onboardingFormStatus === "submitted"
  );

  useEffect(() => {
    if (client.onboardingFormStatus === "submitted") {
      setSubmitted(true);
    }
  }, [client.onboardingFormStatus]);

  const persistDraft = useCallback(
    (nextStep: 1 | 2 | 3, nextAnswers: Partial<ClientOnboardingAnswers>) => {
      saveOnboardingDraft(client.id, {
        currentStep: nextStep,
        answers: nextAnswers,
        updatedAt: new Date().toISOString(),
      });
    },
    [client.id, saveOnboardingDraft]
  );

  function updateField<K extends keyof ClientOnboardingAnswers>(
    key: K,
    value: ClientOnboardingAnswers[K]
  ) {
    setAnswers((prev) => {
      const next = { ...prev, [key]: value };
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  function toggleTool(tool: DataSourceTool) {
    const current = answers.selectedTools ?? [];
    const next = current.includes(tool)
      ? current.filter((t) => t !== tool)
      : [...current, tool];
    updateField("selectedTools", next);
  }

  function goNext() {
    if (step === 1) {
      const e = validateStep1(answers);
      if (Object.keys(e).length) {
        setErrors(e);
        return;
      }
      persistDraft(2, answers);
      setStep(2);
    } else if (step === 2) {
      const e = validateStep2(answers);
      if (Object.keys(e).length) {
        setErrors(e);
        return;
      }
      persistDraft(3, answers);
      setStep(3);
    } else if (step === 3) {
      const e = validateStep3(answers);
      if (Object.keys(e).length) {
        setErrors(e);
        return;
      }
      persistDraft(3, answers);
      setStep("review");
    }
  }

  function goBack() {
    if (step === "review") setStep(3);
    else if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  }

  function handleSubmit() {
    const e1 = validateStep1(answers);
    const e2 = validateStep2(answers);
    const e3 = validateStep3(answers);
    const all = { ...e1, ...e2, ...e3 };
    if (Object.keys(all).length) {
      setErrors(all);
      return;
    }
    const full = toFullAnswers(answers);
    submitOnboarding(client.id, full);
    setSubmitted(true);
  }

  if (submitted && !embedded) {
    return (
      <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-6 text-center">
        <h1 className="text-xl font-semibold text-ink">Thank you</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Your details have been submitted. Continue below for next steps with
          our team.
        </p>
      </div>
    );
  }

  if (submitted && embedded) {
    return null;
  }

  return (
    <div>
      {!embedded && (
        <>
          <h1 className="text-2xl font-semibold text-ink">Client onboarding</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Help us understand your business so we can build your dashboard.
          </p>
        </>
      )}

      <div className="mt-6 flex gap-2">
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const active = step === n || (step === "review" && n === 3);
          const done =
            (step !== 1 && n === 1) ||
            (typeof step === "number" && step > n) ||
            step === "review";
          return (
            <div
              key={label}
              className={`flex-1 rounded-lg border px-2 py-2 text-center text-xs ${
                active
                  ? "border-purple bg-purple-50 text-purple"
                  : done
                    ? "border-purple-100 bg-white text-ink-muted"
                    : "border-purple-100 text-ink-subtle"
              }`}
            >
              {label}
            </div>
          );
        })}
      </div>

      <div className="mt-6 space-y-4">
        {step === 1 && (
          <>
            <Field label="Company name" required error={errors.company}>
              <input
                className={inputClass(errors.company)}
                value={answers.company ?? ""}
                onChange={(e) => updateField("company", e.target.value)}
              />
            </Field>
            <Field label="Contact name" required error={errors.contactName}>
              <input
                className={inputClass(errors.contactName)}
                value={answers.contactName ?? ""}
                onChange={(e) => updateField("contactName", e.target.value)}
              />
            </Field>
            <Field label="Email" required error={errors.email}>
              <input
                type="email"
                className={inputClass(errors.email)}
                value={answers.email ?? ""}
                onChange={(e) => updateField("email", e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                className={inputClass()}
                value={answers.phone ?? ""}
                onChange={(e) => updateField("phone", e.target.value)}
              />
            </Field>
            <Field label="Company website">
              <input
                type="url"
                placeholder="https://example.com"
                className={inputClass()}
                value={answers.website ?? ""}
                onChange={(e) => updateField("website", e.target.value)}
              />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field
              label="What does your business do?"
              required
              error={errors.businessDescription}
            >
              <textarea
                rows={3}
                className={textareaClass(errors.businessDescription)}
                value={answers.businessDescription ?? ""}
                onChange={(e) =>
                  updateField("businessDescription", e.target.value)
                }
              />
            </Field>
            <Field
              label="What do you want to see or track in the dashboard?"
              required
              error={errors.dashboardGoals}
            >
              <textarea
                rows={3}
                className={textareaClass(errors.dashboardGoals)}
                value={answers.dashboardGoals ?? ""}
                onChange={(e) => updateField("dashboardGoals", e.target.value)}
              />
            </Field>
            <Field label="What is difficult about your current reporting process?">
              <textarea
                rows={2}
                className={textareaClass()}
                value={answers.reportingPainPoints ?? ""}
                onChange={(e) =>
                  updateField("reportingPainPoints", e.target.value)
                }
              />
            </Field>
            <Field label="Who will use the dashboard?">
              <input
                className={inputClass()}
                value={answers.dashboardUsers ?? ""}
                onChange={(e) => updateField("dashboardUsers", e.target.value)}
              />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <fieldset>
              <legend className="mb-2 block text-xs font-medium text-ink-muted">
                Which tools do you use today? <span className="text-red-500">*</span>
              </legend>
              {errors.selectedTools && (
                <p className="mb-2 text-xs text-red-600">{errors.selectedTools}</p>
              )}
              <div className="space-y-2">
                {DATA_SOURCE_TOOLS.map(({ id, label }) => (
                  <label
                    key={id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-purple-100 px-3 py-2.5 hover:bg-purple-50/40"
                  >
                    <input
                      type="checkbox"
                      checked={answers.selectedTools?.includes(id) ?? false}
                      onChange={() => toggleTool(id)}
                      className="rounded border-purple-300 text-purple focus:ring-purple"
                    />
                    <span className="text-sm text-ink">{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-xs text-ink-subtle">
              Selecting a tool records a requirement only — it does not connect
              an integration or guarantee support.
            </p>
            {answers.selectedTools?.includes("other") && (
              <Field label="Describe other tool" error={errors.otherToolExplanation}>
                <input
                  className={inputClass(errors.otherToolExplanation)}
                  value={answers.otherToolExplanation ?? ""}
                  onChange={(e) =>
                    updateField("otherToolExplanation", e.target.value)
                  }
                />
              </Field>
            )}
            <Field label="Notes about how you use these tools">
              <textarea
                rows={2}
                className={textareaClass()}
                value={answers.toolsNotes ?? ""}
                onChange={(e) => updateField("toolsNotes", e.target.value)}
              />
            </Field>
          </>
        )}

        {step === "review" && (
          <div className="space-y-4 rounded-xl border border-purple-100 bg-white p-4 text-sm">
            <ReviewBlock title="Business details">
              <p>{answers.company}</p>
              <p className="text-ink-muted">{answers.contactName}</p>
              <p className="text-ink-muted">{answers.email}</p>
              {answers.phone && <p className="text-ink-muted">{answers.phone}</p>}
              {answers.website && <p className="text-ink-muted">{answers.website}</p>}
            </ReviewBlock>
            <ReviewBlock title="Your dashboard">
              <p>{answers.businessDescription}</p>
              <p className="mt-2 text-ink-muted">{answers.dashboardGoals}</p>
              {answers.reportingPainPoints && (
                <p className="mt-2 text-ink-muted">{answers.reportingPainPoints}</p>
              )}
              {answers.dashboardUsers && (
                <p className="mt-2 text-ink-muted">Users: {answers.dashboardUsers}</p>
              )}
            </ReviewBlock>
            <ReviewBlock title="Current tools">
              <p>{formatToolsList(answers.selectedTools ?? [])}</p>
              {answers.otherToolExplanation && (
                <p className="mt-1 text-ink-muted">{answers.otherToolExplanation}</p>
              )}
              {answers.toolsNotes && (
                <p className="mt-1 text-ink-muted">{answers.toolsNotes}</p>
              )}
            </ReviewBlock>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between gap-3">
        {step !== 1 ? (
          <button type="button" onClick={goBack} className={secondaryBtn}>
            Back
          </button>
        ) : (
          <span />
        )}
        {step === "review" ? (
          <button type="button" onClick={handleSubmit} className={primaryBtn}>
            Submit
          </button>
        ) : (
          <button type="button" onClick={goNext} className={primaryBtn}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-purple">
        {title}
      </h3>
      <div className="mt-1 text-ink">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </label>
  );
}

function inputClass(error?: string) {
  return `w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 ${
    error
      ? "border-red-300 focus:border-red-400 focus:ring-red-200"
      : "border-purple-100 focus:border-purple focus:ring-purple-200"
  }`;
}

function textareaClass(error?: string) {
  return inputClass(error) + " resize-y";
}

const primaryBtn =
  "rounded-lg bg-purple px-5 py-2 text-sm font-medium text-white hover:bg-purple-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple";

const secondaryBtn =
  "rounded-lg border border-purple-100 px-5 py-2 text-sm font-medium text-ink hover:bg-purple-50";

"use client";

import { useState } from "react";
import {
  DEFAULT_MONTHLY_FEE,
  DEFAULT_SETUP_FEE,
  useClientStore,
} from "@/lib/client-store";
import {
  parseFee,
  validateFee,
  validateRequired,
} from "@/lib/form-validation";

interface AddClientModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (clientId: string) => void;
}

type FormErrors = Record<string, string>;

const emptyForm = () => ({
  company: "",
  contactName: "",
  email: "",
  phone: "",
  setupFee: String(DEFAULT_SETUP_FEE),
  monthlyFee: String(DEFAULT_MONTHLY_FEE),
  paymentOnly: false,
});

export function AddClientModal({ open, onClose, onCreated }: AddClientModalProps) {
  const { addClient } = useClientStore();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});

  if (!open) return null;

  function setField<K extends keyof ReturnType<typeof emptyForm>>(
    key: K,
    value: ReturnType<typeof emptyForm>[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function resetForm() {
    setForm(emptyForm());
    setErrors({});
  }

  function handleCancel() {
    resetForm();
    onClose();
  }

  function validate(): FormErrors {
    const next: FormErrors = {};

    const companyError = validateRequired(form.company, "Company name");
    if (companyError) next.company = companyError;

    const contactError = validateRequired(form.contactName, "Contact name");
    if (contactError) next.contactName = contactError;

    const emailRequired = validateRequired(form.email, "Email");
    if (emailRequired) {
      next.email = emailRequired;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = "Enter a valid email address.";
    }

    const setupError = validateFee(form.setupFee, "Setup fee");
    if (setupError) next.setupFee = setupError;

    const monthlyError = validateFee(form.monthlyFee, "Monthly fee");
    if (monthlyError) next.monthlyFee = monthlyError;

    return next;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const client = addClient({
      company: form.company.trim(),
      contactName: form.contactName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      onboardingPath: form.paymentOnly ? "payment-only" : "full",
      setupFee: parseFee(form.setupFee),
      monthlyFee: parseFee(form.monthlyFee),
    });

    resetForm();
    onCreated(client.id);
    onClose();
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 bg-ink/30"
        aria-label="Close add client dialog"
        onClick={handleCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-client-title"
        className="fixed inset-x-4 top-[12vh] z-50 mx-auto w-full max-w-md rounded-xl border border-purple-100 bg-white shadow-card sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2"
      >
        <div className="border-b border-purple-100 px-5 py-4 sm:px-6">
          <h2 id="add-client-title" className="text-lg font-semibold text-ink">
            Add client
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Creates a pending client record. No invitation is sent.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-5 py-4 sm:px-6">
            <Field label="Company name" required error={errors.company}>
              <input
                type="text"
                value={form.company}
                onChange={(e) => setField("company", e.target.value)}
                className={inputClass(errors.company)}
                aria-invalid={!!errors.company}
              />
            </Field>
            <Field label="Contact name" required error={errors.contactName}>
              <input
                type="text"
                value={form.contactName}
                onChange={(e) => setField("contactName", e.target.value)}
                className={inputClass(errors.contactName)}
                aria-invalid={!!errors.contactName}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email" required error={errors.email}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  className={inputClass(errors.email)}
                  aria-invalid={!!errors.email}
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  className={inputClass()}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Setup fee (USD)" error={errors.setupFee}>
                <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-purple">
                      $
                    </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.setupFee}
                    onChange={(e) => setField("setupFee", e.target.value)}
                    className={inputClass(errors.setupFee) + " pl-7"}
                    aria-invalid={!!errors.setupFee}
                  />
                </div>
              </Field>
              <Field label="Monthly fee (USD)" error={errors.monthlyFee}>
                <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-purple">
                      $
                    </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.monthlyFee}
                    onChange={(e) => setField("monthlyFee", e.target.value)}
                    className={inputClass(errors.monthlyFee) + " pl-7"}
                    aria-invalid={!!errors.monthlyFee}
                  />
                </div>
              </Field>
            </div>
            <div className="rounded-lg border border-purple-100 bg-purple-50/40 px-3 py-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.paymentOnly}
                  onChange={(e) => setField("paymentOnly", e.target.checked)}
                  className="mt-0.5 rounded border-purple-300 text-purple focus:ring-purple"
                />
                <span className="text-sm text-ink">
                  Payment only — skip the client onboarding form
                </span>
              </label>
              <p className="mt-2 pl-7 text-xs text-ink-muted">
                Choose this if you&apos;ve already collected their onboarding
                details.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-purple-100 px-5 py-4 sm:px-6">
            <button type="button" onClick={handleCancel} className={secondaryBtnClass}>
              Cancel
            </button>
            <button type="submit" className={primaryBtnClass}>
              Add client
            </button>
          </div>
        </form>
      </div>
    </>
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
  return `w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-subtle/60 focus:outline-none focus:ring-1 ${
    error
      ? "border-red-300 focus:border-red-400 focus:ring-red-200"
      : "border-purple-100 focus:border-purple focus:ring-purple-200"
  }`;
}

const primaryBtnClass =
  "rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple";

const secondaryBtnClass =
  "rounded-lg border border-purple-100 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-purple-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple";

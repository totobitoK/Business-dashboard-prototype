"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClientPageShell } from "@/components/onboarding/PaymentPreview";
import {
  DEFAULT_MONTHLY_FEE,
  DEFAULT_SETUP_FEE,
  useClientStore,
} from "@/lib/client-store";
import { validateRequired } from "@/lib/form-validation";
import { clientRoutes } from "@/lib/routes";

export default function OnboardingStartPage() {
  const router = useRouter();
  const { addClient } = useClientStore();
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};

    const companyError = validateRequired(company, "Company name");
    if (companyError) next.company = companyError;

    const contactError = validateRequired(contactName, "Contact name");
    if (contactError) next.contactName = contactError;

    const emailRequired = validateRequired(email, "Email");
    if (emailRequired) {
      next.email = emailRequired;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }

    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    const client = addClient({
      company: company.trim(),
      contactName: contactName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      onboardingPath: "full",
      setupFee: DEFAULT_SETUP_FEE,
      monthlyFee: DEFAULT_MONTHLY_FEE,
      initialNote: "Self-serve onboarding started",
    });

    router.push(clientRoutes.onboarding(client.id));
  }

  return (
    <ClientPageShell>
      <h1 className="text-2xl font-semibold text-ink">Get started</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Tell us who you are and we&apos;ll walk you through onboarding. Demo
        access only — no email sign-in yet; your progress stays on this device.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Company name" required error={errors.company}>
          <input
            className={inputClass(errors.company)}
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
              setErrors((prev) => {
                const next = { ...prev };
                delete next.company;
                return next;
              });
            }}
          />
        </Field>
        <Field label="Your name" required error={errors.contactName}>
          <input
            className={inputClass(errors.contactName)}
            value={contactName}
            onChange={(e) => {
              setContactName(e.target.value);
              setErrors((prev) => {
                const next = { ...prev };
                delete next.contactName;
                return next;
              });
            }}
          />
        </Field>
        <Field label="Email" required error={errors.email}>
          <input
            type="email"
            className={inputClass(errors.email)}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((prev) => {
                const next = { ...prev };
                delete next.email;
                return next;
              });
            }}
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            className={inputClass()}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <button type="submit" className={primaryBtn}>
          Continue to onboarding
        </button>
      </form>
    </ClientPageShell>
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

const primaryBtn =
  "w-full rounded-lg bg-purple px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple";

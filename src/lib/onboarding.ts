import { canActivateClientFromMilestones, canShowDepositPreview } from "./client-milestones";
import type {
  Client,
  OnboardingPath,
  OnboardingStep,
  FullOnboardingStep,
  PaymentOnlyOnboardingStep,
} from "./types";

export const FULL_ONBOARDING_STEPS: FullOnboardingStep[] = [
  "requirements-submitted",
  "scope-pricing-confirmed",
  "setup-payment-received",
  "dashboard-ready",
  "active",
];

export const PAYMENT_ONLY_ONBOARDING_STEPS: PaymentOnlyOnboardingStep[] = [
  "setup-payment-received",
  "dashboard-ready",
  "active",
];

export const STEP_LABELS: Record<OnboardingStep, string> = {
  "requirements-submitted": "Requirements submitted",
  "scope-pricing-confirmed": "Scope & pricing confirmed",
  "setup-payment-received": "Setup payment received",
  "dashboard-ready": "Dashboard ready",
  active: "Active",
};

export const NEXT_STEP_LABELS: Record<OnboardingStep, string> = {
  "requirements-submitted": "Awaiting client requirements",
  "scope-pricing-confirmed": "Awaiting scope & pricing review",
  "setup-payment-received": "Awaiting payment",
  "dashboard-ready": "Preparing dashboard",
  active: "Awaiting activation",
};

export function getStepsForPath(path: OnboardingPath): OnboardingStep[] {
  return path === "full" ? FULL_ONBOARDING_STEPS : PAYMENT_ONLY_ONBOARDING_STEPS;
}

export function getOnboardingProgress(client: Client): number {
  const steps = getStepsForPath(client.onboardingPath);
  const completed = steps.filter((s) => client.completedSteps.includes(s)).length;
  return Math.round((completed / steps.length) * 100);
}

export function getNextStep(client: Client): OnboardingStep | null {
  const steps = getStepsForPath(client.onboardingPath);
  for (const step of steps) {
    if (!client.completedSteps.includes(step)) {
      return step;
    }
  }
  return null;
}

export function getNextStepLabel(client: Client): string | null {
  const step = getNextStep(client);
  if (!step) return null;

  if (
    step === "setup-payment-received" &&
    client.setupPaidAmount > 0 &&
    client.setupPaidAmount < client.setupFee
  ) {
    return "Awaiting remaining payment";
  }

  return NEXT_STEP_LABELS[step];
}

export function getStepState(
  client: Client,
  step: OnboardingStep
): "completed" | "current" | "upcoming" {
  if (client.completedSteps.includes(step)) return "completed";
  const next = getNextStep(client);
  if (next === step) return "current";
  return "upcoming";
}

export function isOnboardingComplete(client: Client): boolean {
  const steps = getStepsForPath(client.onboardingPath);
  return steps.every((s) => client.completedSteps.includes(s));
}

export function canActivateClient(client: Client): boolean {
  return canActivateClientFromMilestones(client);
}

export function getSetupRemaining(client: Client): number {
  if (client.status !== "pending") return 0;
  return Math.max(0, client.setupFee - client.setupPaidAmount);
}

export function isScopePricingConfirmed(client: Client): boolean {
  return (
    client.completedSteps.includes("scope-pricing-confirmed") ||
    !!client.scopePricingConfirmedAt
  );
}

export function canShowPaymentPreview(client: Client): boolean {
  return canShowDepositPreview(client);
}

export function getOnboardingFormStatusLabel(client: Client): string {
  if (client.onboardingPath === "payment-only") {
    return "Not applicable (payment only)";
  }
  switch (client.onboardingFormStatus) {
    case "submitted":
      return "Submitted";
    case "in-progress":
      return "In progress";
    default:
      return "Not started";
  }
}

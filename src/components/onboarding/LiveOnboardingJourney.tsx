"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ClientOnboardingForm } from "@/components/onboarding/ClientOnboardingForm";
import { ScopeAcceptancePanel } from "@/components/onboarding/ScopeAcceptancePanel";
import { ClientPageShell } from "@/components/onboarding/PaymentPreview";
import {
  customerAcceptScopeAction,
  customerRequestScopeChangesAction,
  saveIntakeDraftAction,
  submitIntakeAction,
} from "@/lib/actions/milestone2-rpc";
import { isMilestoneComplete } from "@/lib/client-milestones";
import type { OnboardingIntakeApi } from "@/lib/onboarding-intake-api";
import type { OnboardingScopeApi } from "@/lib/onboarding-scope-api";
import type { Client } from "@/lib/types";

export function LiveOnboardingJourney({
  client,
  initialDraftVersion,
}: {
  client: Client;
  initialDraftVersion: number;
}) {
  const router = useRouter();
  const [draftVersion, setDraftVersion] = useState(initialDraftVersion);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const intakeApi: OnboardingIntakeApi = useMemo(
    () => ({
      draftVersion,
      setDraftVersion,
      async saveOnboardingDraft(projectId, draft) {
        const result = await saveIntakeDraftAction(projectId, draftVersion, draft);
        if (result.ok) {
          setDraftVersion(result.draftVersion);
          refresh();
        }
        return result;
      },
      async submitOnboarding(projectId, answers) {
        const result = await submitIntakeAction(projectId, draftVersion, answers);
        if (result.ok) refresh();
        return result;
      },
    }),
    [draftVersion, refresh]
  );

  const scopeApi: OnboardingScopeApi = useMemo(
    () => ({
      async acceptCustomerScopePricing(projectId, revision, scopeRevisionRowId) {
        const result = await customerAcceptScopeAction(
          projectId,
          revision,
          scopeRevisionRowId
        );
        if (result.ok) refresh();
        return result;
      },
      async requestCustomerScopeChanges(projectId, revision, note) {
        const result = await customerRequestScopeChangesAction(projectId, revision, note);
        if (result.ok) refresh();
        return result;
      },
    }),
    [refresh]
  );

  const intakeDone = isMilestoneComplete(client, "intake");

  return (
    <ClientPageShell client={client}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Your onboarding</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {client.company} · RavenView
          </p>
        </div>

        <section className="rounded-xl border border-purple-100 bg-white p-5 shadow-soft">
          <h2 className="text-sm font-semibold text-ink">Requirements intake</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Saves automatically while you work. Resume anytime from any signed-in device.
          </p>
          <div className="mt-4">
            <ClientOnboardingForm
              client={client}
              intakeApi={intakeApi}
              embedded
            />
          </div>
        </section>

        {intakeDone ? (
          <section className="rounded-xl border border-purple-100 bg-white p-5 shadow-soft">
            <h2 className="text-sm font-semibold text-ink">Scope & pricing</h2>
            <ScopeAcceptancePanel client={client} scopeApi={scopeApi} />
          </section>
        ) : (
          <p className="text-sm text-ink-muted">
            Submit your requirements to unlock scope review.
          </p>
        )}

        <section className="rounded-xl border border-dashed border-purple-100 bg-purple-50/30 p-4 text-sm text-ink-muted">
          <p className="font-medium text-ink">Not available in this milestone</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Setup payments and billing</li>
            <li>Dashboard preview feedback</li>
            <li>Launch activation</li>
          </ul>
        </section>
      </div>
    </ClientPageShell>
  );
}

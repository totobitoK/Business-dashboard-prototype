"use client";

import { useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClientOnboardingJourney } from "@/components/onboarding/ClientOnboardingJourney";
import { LiveBuildPreviewSection } from "@/components/onboarding/LiveBuildPreviewSection";
import { ClientPageShell } from "@/components/onboarding/PaymentPreview";
import {
  customerAcceptScopeAction,
  customerRequestScopeChangesAction,
  saveIntakeDraftAction,
  submitIntakeAction,
} from "@/lib/actions/milestone2-rpc";
import { LiveIntakePersistQueue } from "@/lib/onboarding-live-intake-persist";
import type { OnboardingIntakeApi } from "@/lib/onboarding-intake-api";
import type { OnboardingScopeApi } from "@/lib/onboarding-scope-api";
import type { Client, ClientOnboardingAnswers, ClientOnboardingDraft } from "@/lib/types";
import { toFullAnswers } from "@/lib/onboarding-form";

export function LiveOnboardingJourney({
  client,
  initialDraftVersion,
}: {
  client: Client;
  initialDraftVersion: number;
}) {
  const router = useRouter();
  const queueRef = useRef<LiveIntakePersistQueue | null>(null);
  if (!queueRef.current) {
    queueRef.current = new LiveIntakePersistQueue(initialDraftVersion);
  }
  const queue = queueRef.current;

  useEffect(() => {
    queue.setDraftVersion(initialDraftVersion);
  }, [initialDraftVersion, queue]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const intakeApi: OnboardingIntakeApi = useMemo(
    () => ({
      get draftVersion() {
        return queue.getDraftVersion();
      },
      setDraftVersion(version: number) {
        queue.setDraftVersion(version);
      },
      async saveOnboardingDraft(projectId: string, draft: ClientOnboardingDraft) {
        const result = await queue.enqueueSave(projectId, draft, async (id, expected, d) => {
          const res = await saveIntakeDraftAction(id, expected, d);
          if (!res.ok) {
            return {
              ok: false as const,
              error: res.error,
              conflict: res.error.includes("out of date"),
            };
          }
          return { ok: true as const, draftVersion: res.draftVersion };
        });
        if (result.ok) refresh();
        return result;
      },
      async submitOnboarding(projectId: string, answers: ClientOnboardingAnswers) {
        await queue.waitUntilIdle();
        const full = toFullAnswers(answers);
        const result = await queue.enqueueSubmit(projectId, full, async (id, expected, sub) => {
          const res = await submitIntakeAction(id, expected, sub);
          return res.ok ? { ok: true as const } : { ok: false as const, error: res.error };
        });
        if (result.ok) refresh();
        return result;
      },
    }),
    [queue, refresh]
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

  return (
    <ClientPageShell client={client}>
      <div className="space-y-8">
        <ClientOnboardingJourney client={client} intakeApi={intakeApi} scopeApi={scopeApi} />
        <LiveBuildPreviewSection client={client} />
      </div>
    </ClientPageShell>
  );
}

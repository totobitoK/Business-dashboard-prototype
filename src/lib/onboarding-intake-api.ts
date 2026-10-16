import type { ClientOnboardingAnswers, ClientOnboardingDraft } from "@/lib/types";

type DemoIntakeStore = {
  saveOnboardingDraft: (
    id: string,
    draft: ClientOnboardingDraft
  ) => { ok: boolean; error?: string };
  submitOnboarding: (
    id: string,
    answers: ClientOnboardingAnswers
  ) => { ok: boolean; error?: string };
};

export type OnboardingIntakeApi = {
  draftVersion: number;
  setDraftVersion: (version: number) => void;
  saveOnboardingDraft: (
    projectId: string,
    draft: ClientOnboardingDraft
  ) => Promise<{ ok: boolean; error?: string; draftVersion?: number }>;
  submitOnboarding: (
    projectId: string,
    answers: ClientOnboardingAnswers
  ) => Promise<{ ok: boolean; error?: string }>;
};

export function createDemoIntakeApi(store: DemoIntakeStore): OnboardingIntakeApi {
  return {
    draftVersion: 1,
    setDraftVersion: () => {},
    async saveOnboardingDraft(id, draft) {
      return store.saveOnboardingDraft(id, draft);
    },
    async submitOnboarding(id, answers) {
      return store.submitOnboarding(id, answers);
    },
  };
}

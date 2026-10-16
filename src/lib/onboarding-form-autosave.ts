import type { ClientOnboardingAnswers, ClientOnboardingDraft } from "./types";

export type OnboardingFormDraftStep = 1 | 2 | 3 | "review";

export type OnboardingAutosavePersistResult = {
  ok: boolean;
  error?: string;
  draftVersion?: number;
};

export type OnboardingAutosavePersistFn = (
  draft: ClientOnboardingDraft
) => OnboardingAutosavePersistResult | Promise<OnboardingAutosavePersistResult>;

export type OnboardingAutosaveStatus = "idle" | "saving" | "saved" | "error";

type LatestDraft = {
  step: OnboardingFormDraftStep;
  answers: Partial<ClientOnboardingAnswers>;
};

export class OnboardingFormAutosaveCoordinator {
  private generation = 0;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private latestDraft: LatestDraft | null = null;

  constructor(
    private readonly debounceMs: number,
    private readonly canPersist: () => boolean,
    private readonly persist: OnboardingAutosavePersistFn,
    private readonly onStatus?: (status: Exclude<OnboardingAutosaveStatus, "idle">, error?: string) => void
  ) {}

  cancelPending(): void {
    if (this.timerId != null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.generation += 1;
    this.latestDraft = null;
  }

  scheduleAutosave(
    step: OnboardingFormDraftStep,
    answers: Partial<ClientOnboardingAnswers>
  ): void {
    if (!this.canPersist()) return;
    this.latestDraft = { step, answers };
    if (this.timerId != null) clearTimeout(this.timerId);
    const generationAtSchedule = this.generation;
    this.onStatus?.("saving");
    this.timerId = setTimeout(() => {
      void (async () => {
        this.timerId = null;
        if (!this.canPersist()) return;
        if (generationAtSchedule !== this.generation) return;
        const latest = this.latestDraft;
        if (!latest) return;
        await this.flushDraft(latest.step, latest.answers, generationAtSchedule);
      })();
    }, this.debounceMs);
  }

  /** Immediate save for navigation; cancels pending debounced writes. */
  async persistNavigation(
    step: OnboardingFormDraftStep,
    answers: Partial<ClientOnboardingAnswers>
  ): Promise<boolean> {
    this.cancelPending();
    this.latestDraft = { step, answers };
    const generation = this.generation;
    return this.flushDraft(step, answers, generation);
  }

  private async flushDraft(
    step: OnboardingFormDraftStep,
    answers: Partial<ClientOnboardingAnswers>,
    generation: number
  ): Promise<boolean> {
    if (!this.canPersist()) return true;
    if (generation !== this.generation) return false;

    const draft: ClientOnboardingDraft = {
      currentStep: step === "review" ? "review" : step,
      answers,
      updatedAt: new Date().toISOString(),
    };
    this.onStatus?.("saving");
    const result = await this.persist(draft);
    if (generation !== this.generation) return false;
    if (result.ok) {
      this.onStatus?.("saved");
      return true;
    }
    this.onStatus?.("error", result.error ?? "Could not save on this device.");
    return false;
  }
}

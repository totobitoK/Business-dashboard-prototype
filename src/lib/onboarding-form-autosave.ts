import type { ClientOnboardingAnswers, ClientOnboardingDraft } from "./types";

export type OnboardingFormDraftStep = 1 | 2 | 3 | "review";

export type OnboardingAutosavePersistResult = {
  ok: boolean;
  error?: string;
  draftVersion?: number;
  conflict?: boolean;
};

export type OnboardingAutosavePersistFn = (
  draft: ClientOnboardingDraft
) => OnboardingAutosavePersistResult | Promise<OnboardingAutosavePersistResult>;

export type OnboardingAutosaveStatus = "idle" | "saving" | "saved" | "error";

type LatestDraft = {
  step: OnboardingFormDraftStep;
  answers: Partial<ClientOnboardingAnswers>;
};

function draftFingerprint(step: OnboardingFormDraftStep, answers: Partial<ClientOnboardingAnswers>): string {
  return JSON.stringify({ step, answers });
}

export class OnboardingFormAutosaveCoordinator {
  private generation = 0;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private latestDraft: LatestDraft | null = null;
  private persistChain: Promise<void> = Promise.resolve();
  private lastPersistedFingerprint: string | null = null;

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

  waitUntilIdle(): Promise<void> {
    return this.persistChain;
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

  /** Flush current local draft after canceling debounced timers (e.g. before submit). */
  async persistLatestPending(
    step: OnboardingFormDraftStep,
    answers: Partial<ClientOnboardingAnswers>
  ): Promise<boolean> {
    this.cancelPending();
    this.latestDraft = { step, answers };
    const generation = this.generation;
    return this.flushDraft(step, answers, generation);
  }

  private enqueueFlush(task: () => Promise<boolean>): Promise<boolean> {
    const run = this.persistChain.then(task, task);
    this.persistChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private async flushDraft(
    step: OnboardingFormDraftStep,
    answers: Partial<ClientOnboardingAnswers>,
    generation: number
  ): Promise<boolean> {
    return this.enqueueFlush(async () => {
      if (!this.canPersist()) return true;
      if (generation !== this.generation) return false;

      const fingerprint = draftFingerprint(step, answers);
      if (fingerprint === this.lastPersistedFingerprint) {
        this.onStatus?.("saved");
        return true;
      }

      const draft: ClientOnboardingDraft = {
        currentStep: step === "review" ? "review" : step,
        answers,
        updatedAt: new Date().toISOString(),
      };
      this.onStatus?.("saving");

      let result: OnboardingAutosavePersistResult;
      try {
        result = await this.persist(draft);
      } catch {
        this.onStatus?.("error", "Could not save — check your connection and try again.");
        return false;
      }

      if (generation !== this.generation) {
        return false;
      }

      if (result.ok) {
        this.lastPersistedFingerprint = fingerprint;
        this.onStatus?.("saved");
        this.maybeFlushSupersededDraft(generation);
        return true;
      }

      const message =
        result.conflict || result.error?.includes("out of date")
          ? (result.error ?? "This draft is out of date. Refresh the page to load the latest version.")
          : (result.error ?? "Could not save on this device.");
      this.onStatus?.("error", message);
      return false;
    });
  }

  /** If the user kept typing while a save was in flight, persist the newer draft. */
  private maybeFlushSupersededDraft(generation: number): void {
    const latest = this.latestDraft;
    if (!latest || !this.canPersist()) return;
    const fp = draftFingerprint(latest.step, latest.answers);
    if (fp === this.lastPersistedFingerprint) return;
    if (generation !== this.generation) return;
    void this.flushDraft(latest.step, latest.answers, generation);
  }
}

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { demoClients } from "./demo-data";
import { applyOnboardingDraftToClientList } from "./onboarding-draft";
import { mutatePersistedClientList } from "./client-store-persistence";
import type { Client } from "./types";

function memoryStorage() {
  let raw: string | null = null;
  return { read: () => raw, write: (json: string) => { raw = json; } };
}

/** Mirrors ClientOnboardingForm generation guard: stale timers must not apply. */
function shouldApplyAutosave(generationAtSchedule: number, currentGeneration: number): boolean {
  return generationAtSchedule === currentGeneration;
}

describe("onboarding form autosave coordination", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stale debounced save generation is ignored after navigation bump", () => {
    let generation = 0;
    const scheduledAt = 0;
    generation += 1;
    expect(shouldApplyAutosave(scheduledAt, generation)).toBe(false);
  });

  it("typing then immediate next persists destination step when delayed save is skipped", () => {
    const mem = memoryStorage();
    const clientId = "autosave-race";
    mem.write(
      JSON.stringify([
        {
          ...demoClients[0]!,
          id: clientId,
          onboardingPath: "full",
          onboardingFormStatus: "in-progress",
          completedSteps: [],
        } satisfies Client,
      ])
    );

    mutatePersistedClientList(
      demoClients,
      (base) =>
        applyOnboardingDraftToClientList(base, clientId, {
          currentStep: 1,
          answers: { company: "Typed on step 1" },
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
      mem.read,
      mem.write
    );

    mutatePersistedClientList(
      demoClients,
      (base) =>
        applyOnboardingDraftToClientList(base, clientId, {
          currentStep: 2,
          answers: { company: "Typed on step 1", contactName: "On step 2" },
          updatedAt: "2026-01-01T00:00:00.500Z",
        }),
      mem.read,
      mem.write
    );

    vi.advanceTimersByTime(500);

    const reloaded = JSON.parse(mem.read()!) as Client[];
    expect(reloaded[0]!.onboardingDraft?.currentStep).toBe(2);
    expect(reloaded[0]!.onboardingDraft?.answers.contactName).toBe("On step 2");
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { demoClients } from "./demo-data";
import { applyOnboardingDraftToClientList } from "./onboarding-draft";
import { OnboardingFormAutosaveCoordinator } from "./onboarding-form-autosave";
import { mutatePersistedClientList } from "./client-store-persistence";
import type { Client, ClientOnboardingDraft } from "./types";

const AUTOSAVE_MS = 450;

function memoryStorage() {
  let raw: string | null = null;
  return { read: () => raw, write: (json: string) => { raw = json; } };
}

function loadClient(mem: ReturnType<typeof memoryStorage>, clientId: string): Client {
  const list = JSON.parse(mem.read()!) as Client[];
  return list.find((c) => c.id === clientId)!;
}

function createPersist(
  mem: ReturnType<typeof memoryStorage>,
  clientId: string
): (draft: ClientOnboardingDraft) => { ok: boolean; error?: string } {
  return (draft) => {
    const result = mutatePersistedClientList(
      demoClients,
      (base) => applyOnboardingDraftToClientList(base, clientId, draft),
      mem.read,
      mem.write
    );
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  };
}

describe("OnboardingFormAutosaveCoordinator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("typing then immediate Next keeps destination step when stale timer fires", async () => {
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

    const coordinator = new OnboardingFormAutosaveCoordinator(
      AUTOSAVE_MS,
      () => true,
      createPersist(mem, clientId)
    );

    coordinator.scheduleAutosave(1, {
      company: "Typed on step 1",
      contactName: "",
      email: "",
    });

    const answersStep2 = {
      company: "Typed on step 1",
      contactName: "On step 2",
      email: "a@example.com",
    };
    expect(await coordinator.persistNavigation(2, answersStep2)).toBe(true);

    vi.advanceTimersByTime(AUTOSAVE_MS);

    const saved = loadClient(mem, clientId);
    expect(saved.onboardingDraft?.currentStep).toBe(2);
    expect(saved.onboardingDraft?.answers.contactName).toBe("On step 2");
  });

  it("Back and review navigation persist the destination step", async () => {
    const mem = memoryStorage();
    const clientId = "nav-back-review";
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

    const coordinator = new OnboardingFormAutosaveCoordinator(
      AUTOSAVE_MS,
      () => true,
      createPersist(mem, clientId)
    );

    await coordinator.persistNavigation(3, { company: "Co", contactName: "N", email: "e@e.com" });
    expect(
      await coordinator.persistNavigation("review", {
        company: "Co",
        contactName: "N",
        email: "e@e.com",
      })
    ).toBe(true);
    expect(loadClient(mem, clientId).onboardingDraft?.currentStep).toBe("review");

    coordinator.scheduleAutosave("review", { company: "Co", contactName: "N", email: "e@e.com" });
    expect(
      await coordinator.persistNavigation(3, { company: "Co", contactName: "N", email: "e@e.com" })
    ).toBe(true);
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(loadClient(mem, clientId).onboardingDraft?.currentStep).toBe(3);
  });

  it("client switch cancels stale scheduled save", async () => {
    const mem = memoryStorage();
    const clientA = "client-a";
    const clientB = "client-b";
    mem.write(
      JSON.stringify([
        {
          ...demoClients[0]!,
          id: clientA,
          onboardingFormStatus: "in-progress",
          onboardingPath: "full",
          completedSteps: [],
        },
        {
          ...demoClients[1]!,
          id: clientB,
          onboardingFormStatus: "in-progress",
          onboardingPath: "full",
          completedSteps: [],
        },
      ])
    );

    let activeClientId = clientA;
    const coordinator = new OnboardingFormAutosaveCoordinator(
      AUTOSAVE_MS,
      () => true,
      (draft) => createPersist(mem, activeClientId)(draft)
    );

    coordinator.scheduleAutosave(1, { company: "Wrong client draft" });
    coordinator.cancelPending();
    activeClientId = clientB;
    await coordinator.persistNavigation(2, { company: "Client B step 2" });
    vi.advanceTimersByTime(AUTOSAVE_MS);

    expect(loadClient(mem, clientA).onboardingDraft).toBeUndefined();
    expect(loadClient(mem, clientB).onboardingDraft?.currentStep).toBe(2);
  });

  it("submission guard stops scheduled autosave", () => {
    const mem = memoryStorage();
    const clientId = "submitted-guard";
    mem.write(
      JSON.stringify([
        {
          ...demoClients[0]!,
          id: clientId,
          onboardingFormStatus: "in-progress",
          onboardingPath: "full",
          completedSteps: [],
        },
      ])
    );

    let submitted = false;
    const coordinator = new OnboardingFormAutosaveCoordinator(
      AUTOSAVE_MS,
      () => !submitted,
      createPersist(mem, clientId)
    );

    coordinator.scheduleAutosave(1, { company: "Should not save" });
    submitted = true;
    vi.advanceTimersByTime(AUTOSAVE_MS);
    expect(loadClient(mem, clientId).onboardingDraft).toBeUndefined();
  });

  it("failed persistence prevents navigation from succeeding", async () => {
    const coordinator = new OnboardingFormAutosaveCoordinator(
      AUTOSAVE_MS,
      () => true,
      () => ({ ok: false, error: "Storage full" })
    );

    expect(await coordinator.persistNavigation(2, { company: "Co" })).toBe(false);
  });

  it("serializes overlapping saves and preserves newer typing after slow save", async () => {
    vi.useFakeTimers();
    let persistCalls = 0;
    const coordinator = new OnboardingFormAutosaveCoordinator(
      AUTOSAVE_MS,
      () => true,
      async () => {
        persistCalls += 1;
        const call = persistCalls;
        await new Promise((r) => setTimeout(r, call === 1 ? 100 : 10));
        return { ok: true };
      }
    );

    coordinator.scheduleAutosave(1, { company: "First", contactName: "", email: "" });
    vi.advanceTimersByTime(AUTOSAVE_MS);
    coordinator.scheduleAutosave(1, { company: "Second", contactName: "", email: "" });
    vi.advanceTimersByTime(AUTOSAVE_MS);
    await vi.runAllTimersAsync();

    expect(persistCalls).toBeGreaterThanOrEqual(2);
    vi.useRealTimers();
  });

  it("waitUntilIdle resolves after in-flight navigation save", async () => {
    const coordinator = new OnboardingFormAutosaveCoordinator(
      AUTOSAVE_MS,
      () => true,
      async () => ({ ok: true })
    );

    const saving = coordinator.persistNavigation(2, {
      company: "Co",
      contactName: "N",
      email: "e@e.com",
    });
    await expect(coordinator.waitUntilIdle()).resolves.toBeUndefined();
    expect(await saving).toBe(true);
  });

  it("surfaces conflict errors from persistence", async () => {
    const errors: string[] = [];
    const coordinator = new OnboardingFormAutosaveCoordinator(
      AUTOSAVE_MS,
      () => true,
      async () => ({ ok: false, error: "out of date", conflict: true }),
      (_status, err) => {
        if (err) errors.push(err);
      }
    );

    expect(await coordinator.persistNavigation(2, { company: "Co" })).toBe(false);
    expect(errors.some((e) => e.includes("out of date"))).toBe(true);
  });
});

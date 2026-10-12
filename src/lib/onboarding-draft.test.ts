import { describe, expect, it } from "vitest";
import { demoClients } from "./demo-data";
import {
  applyOnboardingDraftToClientList,
  canPersistOnboardingDraft,
  mergeOnboardingDraftUpdate,
} from "./onboarding-draft";
import { mutatePersistedClientList } from "./client-store-persistence";
import type { Client } from "./types";

function memoryStorage() {
  let raw: string | null = null;
  return {
    read: () => raw,
    write: (json: string) => {
      raw = json;
    },
    clear: () => {
      raw = null;
    },
  };
}

describe("onboarding draft persistence", () => {
  it("does not overwrite submitted intake", () => {
    const client: Client = {
      ...demoClients[0]!,
      onboardingFormStatus: "submitted",
      onboardingSubmission: {
        company: "Co",
        contactName: "A",
        email: "a@b.com",
        phone: "",
        businessDescription: "x",
        dashboardGoals: "y",
        selectedTools: ["google-sheets"],
        submittedAt: new Date().toISOString(),
      },
    };
    expect(canPersistOnboardingDraft(client)).toBe(false);
    const next = mergeOnboardingDraftUpdate(client, {
      currentStep: 2,
      answers: { company: "Hacked" },
      updatedAt: new Date().toISOString(),
    });
    expect(next).toBeNull();
  });

  it("isolates draft updates by client id", () => {
    const a = { ...demoClients[0]!, id: "a", onboardingFormStatus: "not-started" as const };
    const b = { ...demoClients[1]!, id: "b", onboardingFormStatus: "not-started" as const };
    const list = applyOnboardingDraftToClientList([a, b], "a", {
      currentStep: 2,
      answers: { company: "Draft Co" },
      updatedAt: new Date().toISOString(),
    });
    expect(list.find((c) => c.id === "a")?.onboardingDraft?.answers.company).toBe("Draft Co");
    expect(list.find((c) => c.id === "b")?.onboardingDraft).toBeUndefined();
  });

  it("restores draft after simulated refresh via storage", () => {
    const mem = memoryStorage();
    const clientId = "draft-test-client";
    const start: Client[] = [
      {
        ...demoClients[0]!,
        id: clientId,
        onboardingPath: "full",
        onboardingFormStatus: "in-progress",
        completedSteps: [],
      },
    ];
    mem.write(JSON.stringify(start));

    mutatePersistedClientList(
      demoClients,
      (base) =>
        applyOnboardingDraftToClientList(base, clientId, {
          currentStep: "review",
          answers: { company: "Saved Co", contactName: "N", email: "e@e.com" },
          updatedAt: new Date().toISOString(),
        }),
      mem.read,
      mem.write
    );

    const reloaded = JSON.parse(mem.read()!) as Client[];
    const c = reloaded[0]!;
    expect(c.onboardingDraft?.currentStep).toBe("review");
    expect(c.onboardingDraft?.answers.company).toBe("Saved Co");
  });

  it("ignores draft save after submission", () => {
    const submitted: Client = {
      ...demoClients[0]!,
      id: "submitted-client",
      onboardingFormStatus: "submitted",
      onboardingSubmission: {
        company: "Locked",
        contactName: "A",
        email: "a@b.com",
        phone: "",
        businessDescription: "x",
        dashboardGoals: "y",
        selectedTools: ["google-sheets"],
        submittedAt: new Date().toISOString(),
      },
    };
    const list = applyOnboardingDraftToClientList([submitted], "submitted-client", {
      currentStep: 1,
      answers: { company: "Draft overwrite" },
      updatedAt: new Date().toISOString(),
    });
    expect(list[0]!.onboardingSubmission?.company).toBe("Locked");
    expect(list[0]!.onboardingDraft).toBeUndefined();
  });
});

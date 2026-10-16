import { describe, expect, it } from "vitest";
import { LiveIntakePersistQueue } from "./onboarding-live-intake-persist";
import type { ClientOnboardingDraft } from "./types";

const sampleDraft = (company: string): ClientOnboardingDraft => ({
  currentStep: 1,
  answers: { company, contactName: "A", email: "a@a.com" },
  updatedAt: new Date().toISOString(),
});

describe("LiveIntakePersistQueue", () => {
  it("serializes saves and advances version only on success", async () => {
    const queue = new LiveIntakePersistQueue(1);
    const order: number[] = [];

    const first = queue.enqueueSave("p1", sampleDraft("One"), async (_id, expected) => {
      order.push(expected);
      await new Promise((r) => setTimeout(r, 20));
      return { ok: true, draftVersion: 2 };
    });

    const second = queue.enqueueSave("p1", sampleDraft("Two"), async (_id, expected) => {
      order.push(expected);
      return { ok: true, draftVersion: 3 };
    });

    const [r1, r2] = await Promise.all([first, second]);
    expect(r1.ok && r2.ok).toBe(true);
    expect(order).toEqual([1, 2]);
    expect(queue.getDraftVersion()).toBe(3);
  });

  it("does not advance version when save fails with conflict", async () => {
    const queue = new LiveIntakePersistQueue(4);
    const result = await queue.enqueueSave("p1", sampleDraft("X"), async () => ({
      ok: false,
      error: "out of date",
      conflict: true,
    }));
    expect(result.ok).toBe(false);
    expect(queue.getDraftVersion()).toBe(4);
  });

  it("submit waits behind in-flight save", async () => {
    const queue = new LiveIntakePersistQueue(1);
    let saveDone = false;

    void queue.enqueueSave("p1", sampleDraft("Save"), async () => {
      await new Promise((r) => setTimeout(r, 30));
      saveDone = true;
      return { ok: true, draftVersion: 2 };
    });

    await queue.waitUntilIdle();
    expect(saveDone).toBe(true);

    const submit = await queue.enqueueSubmit(
      "p1",
      {
        company: "Co",
        contactName: "N",
        email: "n@n.com",
        phone: "",
        businessDescription: "Biz",
        dashboardGoals: "Goals",
        selectedTools: ["stripe"],
      },
      async (_id, expected) => {
        expect(expected).toBe(2);
        return { ok: true };
      }
    );
    expect(submit.ok).toBe(true);
  });

  it("chains multiple delayed saves without overlapping expected versions", async () => {
    const queue = new LiveIntakePersistQueue(1);
    const delays = [40, 10, 25];
    const saves = delays.map((ms, i) =>
      queue.enqueueSave("p1", sampleDraft(`v${i}`), async (_id, expected) => {
        await new Promise((r) => setTimeout(r, ms));
        return { ok: true, draftVersion: expected + 1 };
      })
    );
    await Promise.all(saves);
    expect(queue.getDraftVersion()).toBe(1 + delays.length);
  });
});

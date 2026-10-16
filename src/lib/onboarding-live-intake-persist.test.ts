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
    const queue = new LiveIntakePersistQueue(0);
    const order: number[] = [];

    const first = queue.enqueueSave("p1", sampleDraft("One"), async (_id, expected) => {
      order.push(expected);
      await new Promise((r) => setTimeout(r, 20));
      return { ok: true, draftVersion: 1 };
    });

    const second = queue.enqueueSave("p1", sampleDraft("Two"), async (_id, expected) => {
      order.push(expected);
      return { ok: true, draftVersion: 2 };
    });

    const [r1, r2] = await Promise.all([first, second]);
    expect(r1.ok && r2.ok).toBe(true);
    expect(order).toEqual([0, 1]);
    expect(queue.getDraftVersion()).toBe(2);
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
    const queue = new LiveIntakePersistQueue(0);
    let saveDone = false;

    void queue.enqueueSave("p1", sampleDraft("Save"), async () => {
      await new Promise((r) => setTimeout(r, 30));
      saveDone = true;
      return { ok: true, draftVersion: 1 };
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
        expect(expected).toBe(1);
        return { ok: true };
      }
    );
    expect(submit.ok).toBe(true);
  });

  it("chains multiple delayed saves without overlapping expected versions", async () => {
    const queue = new LiveIntakePersistQueue(0);
    const delays = [40, 10, 25];
    const saves = delays.map((ms, i) =>
      queue.enqueueSave("p1", sampleDraft(`v${i}`), async (_id, expected) => {
        await new Promise((r) => setTimeout(r, ms));
        return { ok: true, draftVersion: expected + 1 };
      })
    );
    await Promise.all(saves);
    expect(queue.getDraftVersion()).toBe(delays.length);
  });

  it("two queues with version 0 cannot both succeed on first save (simulated)", async () => {
    let storedVersion = 0;
    let storedCompany = "";

    const simulateDb = async (_id: string, expected: number, draft: ClientOnboardingDraft) => {
      if (storedVersion === 0) {
        if (expected !== 0) return { ok: false as const, error: "conflict", conflict: true };
        storedVersion = 1;
        storedCompany = draft.answers.company ?? "";
        return { ok: true as const, draftVersion: 1 };
      }
      if (expected !== storedVersion) {
        return { ok: false as const, error: "conflict", conflict: true };
      }
      storedVersion += 1;
      storedCompany = draft.answers.company ?? "";
      return { ok: true as const, draftVersion: storedVersion };
    };

    const queueA = new LiveIntakePersistQueue(0);
    const queueB = new LiveIntakePersistQueue(0);

    const [rA, rB] = await Promise.all([
      queueA.enqueueSave("p1", sampleDraft("Tab A"), simulateDb),
      queueB.enqueueSave("p1", sampleDraft("Tab B"), simulateDb),
    ]);

    const wins = [rA, rB].filter((r) => r.ok);
    const loses = [rA, rB].filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(loses).toHaveLength(1);
    expect(storedCompany === "Tab A" || storedCompany === "Tab B").toBe(true);
  });
});

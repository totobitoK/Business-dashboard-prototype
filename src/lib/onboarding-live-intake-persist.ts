import type { ClientOnboardingAnswers, ClientOnboardingDraft } from "@/lib/types";

export type LiveSaveDraftResult =
  | { ok: true; draftVersion: number }
  | { ok: false; error: string; conflict?: boolean };

export type LiveSubmitResult = { ok: true } | { ok: false; error: string };

type SaveOp = (
  projectId: string,
  expectedVersion: number,
  draft: ClientOnboardingDraft
) => Promise<LiveSaveDraftResult>;

type SubmitOp = (
  projectId: string,
  expectedVersion: number,
  answers: ClientOnboardingAnswers
) => Promise<LiveSubmitResult>;

/**
 * Serializes live intake writes and tracks the latest acknowledged DB draft version.
 */
export class LiveIntakePersistQueue {
  private chain: Promise<void> = Promise.resolve();
  private version: number;

  constructor(initialVersion: number) {
    this.version = initialVersion;
  }

  getDraftVersion(): number {
    return this.version;
  }

  setDraftVersion(version: number): void {
    this.version = version;
  }

  waitUntilIdle(): Promise<void> {
    return this.chain;
  }

  enqueueSave(
    projectId: string,
    draft: ClientOnboardingDraft,
    saveOp: SaveOp
  ): Promise<LiveSaveDraftResult> {
    const task = this.chain.then(async () => {
      const expected = this.version;
      const result = await saveOp(projectId, expected, draft);
      if (result.ok) {
        this.version = result.draftVersion;
      }
      return result;
    });
    this.chain = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }

  enqueueSubmit(
    projectId: string,
    answers: ClientOnboardingAnswers,
    submitOp: SubmitOp
  ): Promise<LiveSubmitResult> {
    const task = this.chain.then(async () => {
      const expected = this.version;
      return submitOp(projectId, expected, answers);
    });
    this.chain = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }
}

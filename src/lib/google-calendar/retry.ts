export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withBoundedBackoff<T>(
  fn: () => Promise<T>,
  options: { attempts: number; baseMs: number; label?: string }
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < options.attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i === options.attempts - 1) break;
      const delay = options.baseMs * 2 ** i;
      await sleep(delay);
    }
  }
  throw last;
}

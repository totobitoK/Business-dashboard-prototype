export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withBoundedBackoff<T>(
  fn: () => Promise<T>,
  options: { attempts: number; baseMs: number; retry?: (error: unknown) => boolean }
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < options.attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (options.retry && !options.retry(error)) throw error;
      if (i === options.attempts - 1) break;
      await sleep(options.baseMs * 2 ** i);
    }
  }
  throw last;
}

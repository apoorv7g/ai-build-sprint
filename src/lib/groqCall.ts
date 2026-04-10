let active = 0;
const queue: Array<() => void> = [];
const MAX = parseInt(process.env.GROQ_MAX_CONCURRENT ?? "6", 10);

async function withLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (active < MAX) {
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  }
  return new Promise((res, rej) => {
    queue.push(async () => {
      active++;
      try {
        res(await fn());
      } catch (e) {
        rej(e);
      } finally {
        active--;
        queue.shift()?.();
      }
    });
  });
}

export async function groqCall<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 800
): Promise<T> {
  return withLimit(async () => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (err: unknown) {
        const error = err as { status?: number };
        if (
          (error?.status === 429 || error?.status === 503) &&
          i < retries - 1
        ) {
          await new Promise((r) => setTimeout(r, delay * Math.pow(2, i)));
          continue;
        }
        throw err;
      }
    }
    throw new Error("Max retries exceeded");
  });
}

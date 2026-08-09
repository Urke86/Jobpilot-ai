/**
 * Bounded fetch helper (Phase 5A.1 / S3).
 */
export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const merged: RequestInit = {
      ...init,
      signal: init?.signal
        ? anySignal([init.signal, controller.signal])
        : controller.signal,
    };
    return await fetch(input, merged);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    if (err instanceof Error && /abort/i.test(err.message)) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener(
      'abort',
      () => controller.abort(signal.reason),
      { once: true },
    );
  }
  return controller.signal;
}

export const OPENAI_TIMEOUT_MS = 45_000;
export const GOOGLE_TIMEOUT_MS = 30_000;
export const GMAIL_SYNC_BUDGET_MS = 90_000;
/** ingest-job → analyze-job proxy (slightly above OpenAI bound). */
export const ANALYZE_PROXY_TIMEOUT_MS = 50_000;

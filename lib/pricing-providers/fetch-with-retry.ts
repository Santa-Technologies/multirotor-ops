import "server-only";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;

export type FetchJsonOptions = {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  retries?: number;
  /** Label for error logs. */
  label: string;
};

/**
 * HTTP JSON helper with abort timeout, limited retries on 429/5xx/network errors,
 * and a clear Error message that includes the label (never the secret).
 */
export async function fetchJson<T>(options: FetchJsonOptions): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(options.url, {
        method: options.method ?? "GET",
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(
          `${options.label} HTTP ${response.status} (attempt ${attempt + 1})`,
        );
        await sleep(250 * 2 ** attempt);
        continue;
      }
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `${options.label} HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(250 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${options.label} failed after retries: ${message}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

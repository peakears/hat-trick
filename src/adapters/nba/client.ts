import { DEFAULT_TIMEOUT_MS } from "./constants";
import { NbaApiError } from "./errors";

export interface NbaClientOptions {
  fetch?: typeof fetch; // injectable for tests
  timeoutMs?: number;
}

/** Thin HTTP layer: timeout, status checks, JSON parsing. Takes full URLs, as the data is spread over three hosts. */
export class NbaClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: NbaClientOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Returns the parsed JSON body, unvalidated. The adapter validates it. */
  async get(url: string): Promise<unknown> {
    // AbortSignal.timeout is missing in React Native (Hermes), so use a controller + timer.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`timed out after ${this.timeoutMs} ms`)), this.timeoutMs);
    try {
      let res: Response;
      try {
        res = await this.fetchImpl(url, { signal: controller.signal });
      } catch (err) {
        throw new NbaApiError(`NBA API request failed: ${errorMessage(err, controller)}`, undefined, url);
      }
      if (!res.ok) throw new NbaApiError(`NBA API returned ${res.status}`, res.status, url);
      try {
        return await res.json();
      } catch (err) {
        throw new NbaApiError(`NBA API returned invalid JSON: ${errorMessage(err, controller)}`, res.status, url);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Reports a timeout as such, rather than the generic "Aborted" some fetch implementations throw. */
function errorMessage(err: unknown, controller: AbortController): string {
  const reason: unknown = controller.signal.aborted ? controller.signal.reason : err;
  return reason instanceof Error ? reason.message : String(reason);
}

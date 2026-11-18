import { DEFAULT_BASE_URL, DEFAULT_TIMEOUT_MS } from "./constants";
import { NhlApiError } from "./errors";

export interface NhlClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch; // injectable for tests
  timeoutMs?: number;
}

/** Thin HTTP layer: URL building, timeout, status checks, JSON parsing. */
export class NhlClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: NhlClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Returns the parsed JSON body, unvalidated. The adapter validates it. */
  async get(path: string): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (err) {
      throw new NhlApiError(`NHL API request failed: ${(err as Error).message}`, undefined, url);
    }
    if (!res.ok) {
      throw new NhlApiError(`NHL API returned ${res.status}`, res.status, url);
    }
    try {
      return await res.json();
    } catch (err) {
      throw new NhlApiError(`NHL API returned invalid JSON: ${(err as Error).message}`, res.status, url);
    }
  }
}

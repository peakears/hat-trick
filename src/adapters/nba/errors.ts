import type { z } from "zod";

export class NbaApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly url?: string,
  ) {
    super(message);
    this.name = "NbaApiError";
  }
}

/** The API answered, but a core field was missing or the wrong type (API drift). */
export class NbaResponseError extends NbaApiError {
  constructor(
    message: string,
    url: string,
    readonly issues: z.core.$ZodIssue[],
  ) {
    super(message, undefined, url);
    this.name = "NbaResponseError";
  }
}

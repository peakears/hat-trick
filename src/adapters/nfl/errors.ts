import type { z } from "zod";

export class NflApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly url?: string,
  ) {
    super(message);
    this.name = "NflApiError";
  }
}

/** The API answered, but a core field was missing or the wrong type (API drift). */
export class NflResponseError extends NflApiError {
  constructor(
    message: string,
    url: string,
    readonly issues: z.core.$ZodIssue[],
  ) {
    super(message, undefined, url);
    this.name = "NflResponseError";
  }
}

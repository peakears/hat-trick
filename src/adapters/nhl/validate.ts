import { z } from "zod";
import type { AdapterWarning } from "../../domain";
import { NhlResponseError } from "./errors";

/**
 * Validation policy (fail loudly on core fields, degrade on minor ones):
 * - Core fields use plain zod schemas. A mismatch throws NhlResponseError.
 * - Minor fields use `minor()`. A wrong value is dropped and reported as a warning.
 * - Box score player rows use `lenientArray()`. A broken row is dropped and reported.
 */

// Parsing is synchronous, so a single active collector is safe even when
// several requests are in flight.
let collector: string[] | null = null;

function warn(message: string): void {
  collector?.push(message);
}

function describe(value: unknown): string {
  const text = JSON.stringify(value) ?? String(value);
  const kind = Array.isArray(value) ? "array" : typeof value;
  return `${text.length > 40 ? text.slice(0, 40) + "..." : text} (${kind})`;
}

/** A minor field: absent or null is fine; a wrong value is dropped with a warning. */
export function minor<T extends z.ZodType>(schema: T, field: string) {
  return z
    .union([schema, z.null(), z.undefined()])
    .transform((v) => (v === null ? undefined : v) as z.output<T> | undefined)
    .catch((ctx) => {
      warn(`${field}: unexpected value ${describe(ctx.value)}, ignored`);
      return undefined;
    })
    .optional();
}

/** An array whose invalid items are dropped with a warning instead of failing the response. */
export function lenientArray<T extends z.ZodType>(item: T, field: string) {
  const items = z.array(z.unknown()).transform((list) =>
    list.flatMap((raw, i) => {
      const result = item.safeParse(raw);
      if (result.success) return [result.data as z.output<T>];
      warn(`${field}[${i}] dropped: ${z.prettifyError(result.error).replace(/\n\s*/g, " ")}`);
      return [];
    }),
  );
  // minor() handles absent/null and a non-array value.
  return minor(items, field);
}

export function parseResponse<T extends z.ZodType>(
  schema: T,
  data: unknown,
  url: string,
  onWarning: (w: AdapterWarning) => void,
): z.output<T> {
  const warnings: string[] = [];
  collector = warnings;
  let result: z.ZodSafeParseResult<z.output<T>>;
  try {
    result = schema.safeParse(data) as z.ZodSafeParseResult<z.output<T>>;
  } finally {
    collector = null;
  }
  if (!result.success) {
    throw new NhlResponseError(
      `NHL API response did not match the expected shape:\n${z.prettifyError(result.error)}`,
      url,
      result.error.issues,
    );
  }
  for (const message of warnings) onWarning({ url, message });
  return result.data;
}

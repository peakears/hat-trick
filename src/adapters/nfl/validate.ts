import type { z } from "zod";
import type { AdapterWarning } from "../../domain";
import { parseWith } from "../validate";
import { NflResponseError } from "./errors";

// The policy and helpers are shared by every adapter (../validate.ts); a mismatch here is an NflResponseError.
export { lenientArray, minor } from "../validate";

export function parseResponse<T extends z.ZodType>(
  schema: T,
  data: unknown,
  url: string,
  onWarning: (w: AdapterWarning) => void,
): z.output<T> {
  return parseWith(
    schema,
    data,
    url,
    onWarning,
    (details, issues) =>
      new NflResponseError(`NFL API response did not match the expected shape:\n${details}`, url, issues),
  );
}

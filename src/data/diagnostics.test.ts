import { describe, expect, it } from "vitest";
import { DiagnosticsLog, LOG_KEY, LOG_MAX, addToLog, parseLog, type NewLogEntry } from "./diagnostics";
import { MemoryStore } from "./store";

const problem = (over: Partial<NewLogEntry> = {}): NewLogEntry => ({
  kind: "warning",
  league: "nhl",
  key: "nhl:scores:2026-11-17",
  url: "https://api-web.nhle.com/v1/score/2026-11-17",
  message: 'savePctg: unexpected value ".905" (string), ignored',
  ...over,
});

describe("addToLog", () => {
  it("adds new problems newest first", () => {
    const log = addToLog(addToLog([], problem(), 1), problem({ message: "other" }), 2);
    expect(log.map((e) => [e.message, e.count, e.firstAt, e.lastAt])).toEqual([
      ["other", 1, 2, 2],
      ['savePctg: unexpected value ".905" (string), ignored', 1, 1, 1],
    ]);
  });

  it("folds a repeat into its entry and moves it to the top", () => {
    let log = addToLog([], problem(), 1);
    log = addToLog(log, problem({ message: "other" }), 2);
    log = addToLog(log, problem(), 3);
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ message: problem().message, count: 2, firstAt: 1, lastAt: 3 });
  });

  it("keeps problems apart when the kind, request or URL differ", () => {
    let log = addToLog([], problem(), 1);
    log = addToLog(log, problem({ kind: "error" }), 2);
    log = addToLog(log, problem({ key: "nhl:standings" }), 3);
    log = addToLog(log, problem({ url: undefined }), 4);
    expect(log).toHaveLength(4);
  });

  it("drops the oldest past the cap", () => {
    let log = addToLog([], problem({ message: "first" }), 0);
    for (let i = 1; i <= LOG_MAX; i++) log = addToLog(log, problem({ message: `m${i}` }), i);
    expect(log).toHaveLength(LOG_MAX);
    expect(log.some((e) => e.message === "first")).toBe(false);
    expect(log[0].message).toBe(`m${LOG_MAX}`);
  });
});

describe("parseLog", () => {
  it("reads a stored log and drops what is not an entry", () => {
    const good = addToLog([], problem(), 1)[0];
    expect(parseLog(JSON.stringify([good, { kind: "nope" }, null, 3]))).toEqual([good]);
  });

  it("is empty for nothing stored, broken JSON or a non-list", () => {
    expect(parseLog(null)).toEqual([]);
    expect(parseLog("{oops")).toEqual([]);
    expect(parseLog('{"kind":"warning"}')).toEqual([]);
  });
});

describe("DiagnosticsLog", () => {
  it("keeps the log across app launches, outside the cache keys", async () => {
    const store = new MemoryStore();
    await new DiagnosticsLog(store, () => 5).record(problem());
    expect(await store.keys()).toEqual([LOG_KEY]);
    const reopened = await new DiagnosticsLog(store).list();
    expect(reopened).toEqual([expect.objectContaining({ message: problem().message, count: 1, lastAt: 5 })]);
  });

  it("loses nothing when problems are recorded at the same moment", async () => {
    const log = new DiagnosticsLog(new MemoryStore());
    await Promise.all([
      log.record(problem({ message: "a" })),
      log.record(problem({ message: "b" })),
      log.record(problem()),
    ]);
    expect((await log.list()).map((e) => e.message).sort()).toEqual(["a", "b", problem().message].sort());
  });

  it("clears, and tells subscribers about every change", async () => {
    const log = new DiagnosticsLog(new MemoryStore());
    const seen: number[] = [];
    const unsubscribe = log.subscribe((entries) => seen.push(entries.length));
    await log.record(problem());
    await log.clear();
    unsubscribe();
    await log.record(problem());
    expect(seen).toEqual([1, 0]);
    expect(await log.list()).toHaveLength(1);
  });

  it("keeps working in memory when storage fails", async () => {
    const broken = new MemoryStore();
    broken.get = async () => {
      throw new Error("unavailable");
    };
    broken.set = async () => {
      throw new Error("full");
    };
    const log = new DiagnosticsLog(broken);
    await expect(log.record(problem())).resolves.toBeUndefined();
    expect(await log.list()).toHaveLength(1);
  });
});

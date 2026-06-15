/**
 * ast.ts — Abstract Syntax Tree for the Workout DSL
 *
 * The in-memory representation produced by the parser. After parsing,
 * an entry is always in fully-expanded, per-set form: there is no
 * shorthand in the AST. `3x5 @ 185lbs` resolves to three SetEntry
 * objects, each with `reps: 5` and `weight: { value: 185, unit: "lbs" }`.
 *
 * This module is the shared contract for the whole DSL: the parser
 * produces it, the checker reads it, the UI renders it, and the store
 * persists it. Nothing here depends on any other module.
 */

/* ------------------------------------------------------------------ *
 * Core value types
 * ------------------------------------------------------------------ */

/** Weight unit. Defaults to "lbs" when omitted in source. */
export type Unit = "lbs" | "kg";

/**
 * Reps for a single set.
 *   - a plain number for rep-based sets (e.g. 8)
 *   - { seconds } for timed sets (e.g. 60sec → { seconds: 60 })
 */
export type Reps = number | { seconds: number };

/**
 * A resolved weight on a single set.
 * `value: 0` means unspecified — either a planned set not yet logged,
 * or a bodyweight movement. The parser always emits a WeightValue; 0 is
 * the default when no `@ weight` clause is written.
 */
export type WeightValue = {
  value: number;
  unit: Unit;
};

/* ------------------------------------------------------------------ *
 * Tree nodes
 * ------------------------------------------------------------------ */

/**
 * One fully-expanded set. All shorthand has been normalized away by
 * the time a SetEntry exists.
 */
export type SetEntry = {
  /** 1-based position within the exercise (first set is 1, not 0). */
  setNumber: number;
  reps: Reps;
  /** 0 means unspecified (plan placeholder or bodyweight). */
  weight: WeightValue;
};

export type ExerciseEntry = {
  /** Stored exactly as typed — no casing or naming normalization. */
  name: string;
  sets: SetEntry[];
};

export type SupersetEntry = {
  exercises: ExerciseEntry[];
};

/**
 * A single ordered item in a workout — either a standalone exercise or a
 * superset. The `items` array on `WorkoutEntry` preserves the source order so
 * the UI can render them exactly as the user typed them.
 */
export type WorkoutItem =
  | { kind: "exercise"; exercise: ExerciseEntry }
  | { kind: "superset"; superset: SupersetEntry };

/**
 * One session — the top-level product of parsing.
 */
export type WorkoutEntry = {
  exercises: ExerciseEntry[];
  supersets: SupersetEntry[];
  /**
   * Exercises and supersets in their original source order. Always present on
   * freshly-parsed entries; absent on entries loaded from older stored data
   * (use `exercises` + `supersets` as fallback).
   */
  items: WorkoutItem[];
  /** Optional; at most one per session. */
  note?: string;
  /** MM/DD/YY as typed. Absent until a `D:` line is written. */
  date?: string;
  /** Original input text, preserved verbatim so it can be re-edited. */
  raw: string;
};

/* ------------------------------------------------------------------ *
 * Diagnostics + public API contract
 *
 * Warnings are checker output, but they live here because they are the
 * other half of the public parse() return shape and are imported by
 * both checker.ts and index.ts. Move to checker.ts if you'd rather keep
 * ast.ts purely structural.
 * ------------------------------------------------------------------ */

export type WarningSeverity = "warning" | "info";

/** Stable identifier for each semantic-checker rule. */
export type WarningCode =
  | "reps_count_mismatch" // reps list length ≠ sets count
  | "weight_count_mismatch" // weight list length ≠ sets count
  | "zero_weight" // weight of 0 recorded
  | "timed_set_weight" // weight on a time-based set
  | "missing_date" // no Date: line present
  | "invalid_date"; // Date: present but not MM/DD/YY

/**
 * A semantic-checker diagnostic. Warnings never block saving — they
 * surface as subtle inline indicators in the UI.
 */
export type Warning = {
  severity: WarningSeverity;
  code: WarningCode;
  /** Human-readable message shown in the UI. */
  message: string;
  /**
   * 0-based index of the offending line in `raw`, when the warning is
   * tied to a specific line (enables inline underlines). Absent for
   * session-level warnings such as a missing date.
   */
  line?: number;
};

/** Return shape of the public `parse()` entry point. */
export type ParseResult = {
  entry: WorkoutEntry;
  warnings: Warning[];
};
/**
 * parser.ts — Line-by-line, fault-tolerant parser for the Workout DSL.
 *
 * Turns raw session text into a fully-expanded `WorkoutEntry` (per-set form,
 * no shorthand left in the AST). It processes one line at a time and silently
 * skips anything it can't match, so a half-typed workout still yields the best
 * possible entry from the lines that *are* complete.
 *
 * One input = one session. Feeding it a file with several `Date:` blocks will
 * merge them into a single entry (last `Date:` wins, exercises accumulate).
 * Parse each session block as its own input.
 *
 * Warning boundary
 * ----------------
 * The parser only emits the two diagnostics that cannot be recovered from the
 * AST after normalization, because the original list lengths are gone once a
 * mismatched list is collapsed to "first value for all":
 *   - reps_count_mismatch
 *   - weight_count_mismatch
 * The remaining checks (zero_weight, timed_set_weight, missing_date,
 * invalid_date) are all derivable from the finished AST + the stored date
 * string, so they belong in checker.ts. `index.ts` concatenates both sets.
 *
 * Prefix / EBNF notes
 * --------------------
 * - Date / Superset / Note lines use `D:`, `S:`, and `N:` (per the EBNF and
 *   examples). Longer spellings like `Date:` / `Superset:` / `Note:` are NOT accepted.
 * - Weight numbers accept an optional decimal (e.g. `2.5`, `22.5kg`). This is a
 *   deliberate, isolated extension beyond the integer-only EBNF, since fractional
 *   plates are universal in real logging. Reps stay integer-only.
 */

import type {
  WorkoutEntry,
  ExerciseEntry,
  SetEntry,
  WeightValue,
  Unit,
  Reps,
  Warning,
  ParseResult,
} from "./ast";

/* ------------------------------------------------------------------ *
 * Patterns
 * ------------------------------------------------------------------ */

/** Special-line prefixes. Each requires a colon, so they never collide with
 *  exercise names (which are letters + interior spaces only). */
const DATE_RE = /^d\s*:\s*(.*)$/i;
const NOTE_RE = /^n\s*:\s*(.*)$/i;
const SUPERSET_RE = /^s\s*:\s*(.*)$/i;

/**
 * A single exercise spec: `<name> <sets>x<reps> [@ <weight>[unit]]`.
 *
 * Intentionally NOT end-anchored — it extracts the valid prefix and ignores
 * any trailing content, matching the "read left to right, stop when you can't
 * match more tokens" design. The minimum match is `<name> <sets>x<reps>`.
 *
 *   name    letters + interior spaces, lazy (never captures the space before sets)
 *   reps    `<n>sec` (timed) | `[n,n,...]` (per-set list) | `<n>` (uniform)
 *   weight  `[n,n,...]` (per-set list) | `<n>` (uniform), each optionally decimal
 *   unit    `lbs` | `kg`, optional; trailing (`[100,105]kg`) or per-element
 *           (`[100kg,105,110]`). First unit found wins; trailing unit is fallback.
 */
const EXERCISE_RE =
  /^(?<name>[A-Za-z][A-Za-z ]*?)\s+(?<sets>\d+)x(?<reps>\d+sec|\[\s*\d+(?:\s*,\s*\d+)*\s*\]|\d+)(?:\s*@\s*(?<weight>\[\s*\d+(?:\.\d+)?(?:\s*(?:lbs|kg))?(?:\s*,\s*\d+(?:\.\d+)?(?:\s*(?:lbs|kg))?)*\s*\]|\d+(?:\.\d+)?)\s*(?<unit>lbs|kg)?)?/i;

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

/** Split on a delimiter, but only at top level — commas inside `[...]`
 *  (rep lists, weight lists) are preserved. */
function splitTopLevel(s: string, delim = ","): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "[") depth++;
    else if (ch === "]") depth = Math.max(0, depth - 1);
    if (ch === delim && depth === 0) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** `[100,105, 110]` -> [100, 105, 110]. Accepts ints or decimals. */
function parseNumberList(token: string): number[] {
  return token
    .replace(/[\[\]]/g, "")
    .split(",")
    .map((n) => Number(n.trim()));
}

/**
 * Parse a weight list token like `[100kg,105,110]` or `[100,105,110]`.
 * Returns the numeric values and the first unit found inside the list
 * (null if no element carries a unit — caller falls back to trailing unit).
 */
function parseWeightList(token: string): { values: number[]; unit: Unit | null } {
  const ITEM_RE = /(\d+(?:\.\d+)?)\s*(lbs|kg)?/i;
  let unit: Unit | null = null;
  const values = token
    .replace(/[\[\]]/g, "")
    .split(",")
    .map((item) => {
      const m = ITEM_RE.exec(item.trim());
      if (!m) return 0;
      if (m[2] && !unit) unit = m[2].toLowerCase() as Unit;
      return Number(m[1]);
    });
  return { values, unit };
}

const isList = (tok: string) => tok.trimStart().startsWith("[");
const isTimed = (tok: string) => /sec$/i.test(tok);

/**
 * Resolve a uniform value or a per-set list into exactly `sets` values.
 * On a length mismatch, fall back to the first value for every set and report
 * it (the caller turns that into the appropriate warning code).
 */
function resolvePerSet<T>(
  uniformOrList: T | T[],
  sets: number,
): { values: T[]; mismatch: boolean } {
  if (Array.isArray(uniformOrList)) {
    if (uniformOrList.length === sets) {
      return { values: uniformOrList.slice(), mismatch: false };
    }
    const first = uniformOrList[0];
    return { values: Array.from({ length: sets }, () => first), mismatch: true };
  }
  return {
    values: Array.from({ length: sets }, () => uniformOrList),
    mismatch: false,
  };
}

/* ------------------------------------------------------------------ *
 * Exercise spec -> ExerciseEntry
 * ------------------------------------------------------------------ */

/**
 * Parse one exercise spec (a standalone line or a single comma-separated
 * segment of a superset) into a fully-expanded ExerciseEntry.
 * Returns null if the segment isn't a recognizable exercise (skip it).
 * Pushes any list-length-mismatch warnings, tagged with `lineIndex`.
 */
function parseExerciseSpec(
  segment: string,
  lineIndex: number,
  warnings: Warning[],
): ExerciseEntry | null {
  const m = EXERCISE_RE.exec(segment.trim());
  if (!m || !m.groups) return null;

  const name = m.groups.name.trimEnd(); // interior spacing kept verbatim
  const sets = parseInt(m.groups.sets, 10);

  // --- reps -> Reps per set ---
  const repsTok = m.groups.reps;
  let repsPerSet: Reps[];
  if (isTimed(repsTok)) {
    const seconds = parseInt(repsTok, 10);
    repsPerSet = Array.from({ length: sets }, () => ({ seconds }));
  } else {
    const repsValue: number | number[] = isList(repsTok)
      ? parseNumberList(repsTok)
      : parseInt(repsTok, 10);
    const { values, mismatch } = resolvePerSet(repsValue, sets);
    if (mismatch) {
      warnings.push({
        severity: "warning",
        code: "reps_count_mismatch",
        message: "Rep count doesn't match sets — using first value for all",
        line: lineIndex,
      });
    }
    repsPerSet = values;
  }

  // --- weight -> WeightValue per set (0 when unspecified) ---
  const weightTok = m.groups.weight;
  const trailingUnit: Unit = m.groups.unit
    ? (m.groups.unit.toLowerCase() as Unit)
    : "lbs";
  let weightPerSet: WeightValue[];
  if (weightTok === undefined) {
    weightPerSet = Array.from({ length: sets }, () => ({ value: 0, unit: trailingUnit }));
  } else {
    let unit: Unit = trailingUnit;
    let weightValue: number | number[];
    if (isList(weightTok)) {
      const parsed = parseWeightList(weightTok);
      weightValue = parsed.values;
      unit = parsed.unit ?? trailingUnit;
    } else {
      weightValue = Number(weightTok);
    }
    const { values, mismatch } = resolvePerSet(weightValue, sets);
    if (mismatch) {
      warnings.push({
        severity: "warning",
        code: "weight_count_mismatch",
        message: "Weight count doesn't match sets — using first value for all",
        line: lineIndex,
      });
    }
    weightPerSet = values.map((value) => ({ value, unit }));
  }

  // --- zip into SetEntry[] ---
  const setsArr: SetEntry[] = [];
  for (let i = 0; i < sets; i++) {
    setsArr.push({ setNumber: i + 1, reps: repsPerSet[i], weight: weightPerSet[i] });
  }

  return { name, sets: setsArr };
}

/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */

/**
 * Parse a full session's text into a WorkoutEntry plus any parse-time warnings.
 * Never throws and never hard-fails: unrecognized lines are skipped.
 */
export function parseWorkout(input: string): ParseResult {
  const warnings: Warning[] = [];
  const entry: WorkoutEntry = {
    exercises: [],
    supersets: [],
    raw: input,
  };

  const lines = input.split(/\r\n|\r|\n/);

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();

    // 1. blank
    if (line === "") return;
    // 2. comment
    if (line.startsWith("//")) return;

    // 3. D: date — stored verbatim; format is validated by the checker
    let m = DATE_RE.exec(line);
    if (m) {
      entry.date = m[1].trim();
      return;
    }

    // 4. note — free text to end of line; last one wins if repeated
    m = NOTE_RE.exec(line);
    if (m) {
      entry.note = m[1].trim();
      return;
    }

    // 5. superset — comma-separated specs (commas inside [...] are protected)
    m = SUPERSET_RE.exec(line);
    if (m) {
      const exercises: ExerciseEntry[] = [];
      for (const seg of splitTopLevel(m[1])) {
        const ex = parseExerciseSpec(seg, idx, warnings);
        if (ex) exercises.push(ex);
      }
      if (exercises.length > 0) entry.supersets.push({ exercises });
      return;
    }

    // 6. exercise
    const ex = parseExerciseSpec(line, idx, warnings);
    if (ex) {
      entry.exercises.push(ex);
      return;
    }

    // 7. otherwise — silently skipped (probably mid-typing)
  });

  return { entry, warnings };
}
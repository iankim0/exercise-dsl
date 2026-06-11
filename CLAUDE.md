# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install dependencies (vitest only)
npx vitest           # run all tests in watch mode
npx vitest run       # run all tests once
npx vitest run tests/dsl/parser.test.ts  # run a single test file
```

There is no build step, lint config, or dev server — this is a pure parser library tested via Vitest.

## Architecture

This is a TypeScript DSL for parsing human-readable workout logs into a normalized AST.

### Layers

**`dsl/ast.ts`** — type contracts only, no logic. Defines the output shape:
- `WorkoutEntry` → top-level container (date, note, list of `ExerciseEntry | SupersetEntry`)
- `ExerciseEntry` → one exercise with a list of fully-expanded `SetEntry` objects
- `SupersetEntry` → wrapper holding two or more `ExerciseEntry` values
- `SetEntry` → a single set: `{ reps: number | { seconds: number }, weight?: number, unit: "lbs" | "kg" }`
- `ParseResult<T>` → `{ value: T, warnings: Warning[] }` — parser always returns a value even on partial input

**`dsl/parser.ts`** — line-by-line, fault-tolerant parser. Key behaviors:
- Unrecognized lines are silently skipped (fault-tolerant by design)
- All shorthand is fully expanded: `3x5` becomes three `SetEntry` objects each with `reps: 5`
- Commas inside `[...]` are protected before splitting superset exercises on `,`
- No weight on a `SetEntry` means bodyweight (not zero)

**`dsl/ebnf.txt`** — formal grammar spec. The implementation extends it: decimal weights (e.g., `22.5kg`) are supported even though the EBNF shows integers only.

**`dsl/examples.txt`** — canonical usage examples; also used as the basis for integration tests.

### DSL Line Types

| Prefix | Meaning |
|---|---|
| `D: MM/DD/YY` | Session date |
| `N: <text>` | Session note (last one wins) |
| `S: <ex>, <ex>, ...` | Superset |
| `// <text>` | Comment (ignored) |
| `<name> <sets>x<reps> [@ <weight> [unit]]` | Exercise |

Reps and weights can be uniform (`3x5 @ 100`) or per-set lists (`3x[5,3,1] @ [100,110,120]`). List length must equal set count or a `Warning` is emitted.

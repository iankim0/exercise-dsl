import { describe, it, expect } from "vitest";
import { parseWorkout } from "../../dsl/parser";

// Small helper: parse one line and return the first exercise.
const firstExercise = (line: string) => parseWorkout(line).entry.exercises[0];

describe("sets × reps", () => {
  it("uniform NxM expands to N sets of M reps", () => {
    const ex = firstExercise("Squat 3x5 @ 185lbs");
    expect(ex.sets).toHaveLength(3);
    expect(ex.sets.map((s) => s.reps)).toEqual([5, 5, 5]);
    expect(ex.sets.map((s) => s.setNumber)).toEqual([1, 2, 3]);
  });

  it("single set", () => {
    expect(firstExercise("Deadlift 1x5 @ 275lbs").sets).toHaveLength(1);
  });

  it("variable reps per set", () => {
    const ex = firstExercise("OHP 3x[5,3,1] @ 95lbs");
    expect(ex.sets.map((s) => s.reps)).toEqual([5, 3, 1]);
  });

  it("timed set stores { seconds }", () => {
    const ex = firstExercise("Plank 3x60sec");
    expect(ex.sets[0].reps).toEqual({ seconds: 60 });
    expect(ex.sets).toHaveLength(3);
  });
});

describe("weight", () => {
  it("uniform weight applies to all sets", () => {
    const ex = firstExercise("Bench 3x8 @ 135lbs");
    expect(ex.sets.every((s) => s.weight.value === 135)).toBe(true);
  });

  it("unit defaults to lbs when omitted", () => {
    expect(firstExercise("Bench 1x5 @ 135").sets[0].weight).toEqual({
      value: 135,
      unit: "lbs",
    });
  });

  it("kg is preserved", () => {
    expect(firstExercise("Squat 3x5 @ 100kg").sets[0].weight.unit).toBe("kg");
  });

  it("per-set weights zip across sets", () => {
    const ex = firstExercise("Squat 3x5 @ [135,155,185]lbs");
    expect(ex.sets.map((s) => s.weight.value)).toEqual([135, 155, 185]);
  });

  it("variable reps AND weights zip together", () => {
    const ex = firstExercise("Bench 4x[8,6,4,4] @ [115,125,135,135]lbs");
    expect(ex.sets.map((s) => [s.reps, s.weight.value])).toEqual([
      [8, 115],
      [6, 125],
      [4, 135],
      [4, 135],
    ]);
  });

  it("decimal weights are supported", () => {
    expect(firstExercise("Curls 3x10 @ 22.5kg").sets[0].weight.value).toBe(22.5);
  });

  it("exercises without weight default to 0 lbs", () => {
    const ex = firstExercise("Pullups 3x8");
    expect(ex.sets).toHaveLength(3);
    ex.sets.forEach((s) => expect(s.weight).toEqual({ value: 0, unit: "lbs" }));
  });
});

describe("mixed units in one session", () => {
  it("unit is stored per-exercise, not globally", () => {
    const { entry } = parseWorkout("Squat 3x5 @ 100kg\nCurls 3x10 @ 30lbs");
    expect(entry.exercises[0].sets[0].weight.unit).toBe("kg");
    expect(entry.exercises[1].sets[0].weight.unit).toBe("lbs");
  });
});

describe("exercise names", () => {
  it("multi-word names keep interior spacing, stored as typed", () => {
    expect(firstExercise("Hang Power Snatch 5x3 @ 60").name).toBe(
      "Hang Power Snatch",
    );
  });

  it("casing is not normalized", () => {
    expect(firstExercise("Skull crushers 3x10").name).toBe("Skull crushers");
  });
});

describe("special lines", () => {
  it("D: is stored verbatim", () => {
    expect(parseWorkout("D: 06/01/26").entry.date).toBe("06/01/26");
  });

  it("D: can appear anywhere; last one wins", () => {
    const { entry } = parseWorkout("Squat 3x5\nD: 06/01/26\nD: 06/02/26");
    expect(entry.date).toBe("06/02/26");
  });

  it("N: captures free text to end of line", () => {
    const { entry } = parseWorkout("N: Right knee tight, deload next week.");
    expect(entry.note).toBe("Right knee tight, deload next week.");
  });

  it("only one note per session — last wins", () => {
    expect(parseWorkout("N: first\nN: second").entry.note).toBe("second");
  });

  it("// comment lines are ignored", () => {
    const { entry } = parseWorkout("// just a note to self\nSquat 3x5");
    expect(entry.exercises).toHaveLength(1);
  });

  it("long-form Note:/Superset: are NOT recognized", () => {
    const { entry } = parseWorkout("Note: ignored\nSuperset: also ignored");
    expect(entry.note).toBeUndefined();
    expect(entry.supersets).toHaveLength(0);
    expect(entry.exercises).toHaveLength(0);
  });
});

describe("supersets", () => {
  it("comma-separated exercises group under one superset", () => {
    const ss = parseWorkout("S: Lat Pulldown 3x10 @ 120, Cable Row 3x10 @ 100")
      .entry.supersets[0];
    expect(ss.exercises.map((e) => e.name)).toEqual([
      "Lat Pulldown",
      "Cable Row",
    ]);
  });

  it("commas INSIDE [...] do not split the superset", () => {
    const ss = parseWorkout(
      "S: PC 5x[3,2,1,1,1] @ [100,105,110,120,130], Pull Ups 3x6",
    ).entry.supersets[0];
    expect(ss.exercises).toHaveLength(2);
    expect(ss.exercises[0].sets).toHaveLength(5);
    expect(ss.exercises[1].sets[0].weight).toEqual({ value: 0, unit: "lbs" });
  });
});

describe("fault tolerance", () => {
  it("partial / unrecognized lines are skipped silently", () => {
    const { entry, warnings } = parseWorkout(
      "Squat 3x\nBench\nrandom text\nOHP 3x8 @ 85",
    );
    expect(entry.exercises).toHaveLength(1);
    expect(entry.exercises[0].name).toBe("OHP");
    expect(warnings).toHaveLength(0);
  });

  it("preserves the original raw text", () => {
    const src = "D: 06/01/26\nSquat 3x5 @ 185lbs";
    expect(parseWorkout(src).entry.raw).toBe(src);
  });
});

describe("list-length mismatch warnings", () => {
  it("reps list ≠ sets warns and uses the first value for all", () => {
    const { entry, warnings } = parseWorkout("Squat 3x[5,3] @ 185");
    expect(warnings.some((w) => w.code === "reps_count_mismatch")).toBe(true);
    expect(entry.exercises[0].sets.map((s) => s.reps)).toEqual([5, 5, 5]);
    expect(warnings[0].line).toBe(0);
  });

  it("weight list ≠ sets warns and uses the first value for all", () => {
    const { entry, warnings } = parseWorkout("Squat 3x5 @ [135,155]");
    expect(warnings.some((w) => w.code === "weight_count_mismatch")).toBe(true);
    expect(entry.exercises[0].sets.map((s) => s.weight.value)).toEqual([
      135, 135, 135,
    ]);
  });
});

describe("real example sessions", () => {
  // Each block from examples.txt should parse cleanly (no warnings).
  const sessions = [
    "D: 05/25/25\nS: PC 5x[3,2,1,1,1] @ [100,105,110,120,130], Pull Ups 3x6\nFront Squat 3x3 @ [90,110,120]",
    "D: 05/30/25\nFront Squat 4x5 @ [100,110,120,120]\nBB RDL 3x6 @ [70,90,100]\nBroad Jump 3x3\nWeighted Plank 3x30sec @ 25kg",
    "D: 06/06/25\nBB Bench 1x1 @ 260\nN: Finisher — Nickels & Dimes EMOM, 9 rounds: 90 pushups / 42 pullups",
    "D: 06/10/25\nS: Curls 3x[10,8,6] @ [40,45,50], Skull crushers 3x10 @ 60\nBB Bench 3x5 @ 185",
  ];

  it.each(sessions)("parses with no warnings: %s", (src) => {
    const { entry, warnings } = parseWorkout(src);
    expect(warnings).toHaveLength(0);
    expect(entry.date).toBeTruthy();
  });
});
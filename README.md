# Workout DSL

A plain-text language for logging and planning workout sessions. Write a session in a simple shorthand, and the parser converts it into a structured JSON object that the app uses to render a formatted workout view.

---

## How it works

Each session is a block of plain text — one line per exercise, with a few special prefixes for metadata. The parser reads it top to bottom and produces a single session object. Unrecognized or incomplete lines are silently skipped, so you can write a partial plan and fill in the rest later.

---

## Line types

### Date — `D: MM/DD/YY`

Marks the date of the session.

```
D: 06/15/25
```

### Exercise — `<name> <sets>x<reps> [@ <weight> [unit]]`

The core of the language. The name is any sequence of letters and spaces. Sets and reps use the `NxM` format. Weight is optional — omitting it leaves the value as `0`, which is useful for planning a session before you know what you'll lift.

```
Front Squat 4x5 @ 185
```

### Superset — `S: <exercise>, <exercise>, ...`

Groups two or more exercises into a superset. Each exercise follows the same `<name> NxM [@ weight]` format, separated by commas.

```
S: Curls 3x10 @ 50, Skull crushers 3x10 @ 60
```

### Note — `N: <free text>`

Attaches a free-text note to the session. If there are multiple `N:` lines, the last one wins.

```
N: Felt strong today, consider bumping weight next session.
```

### Comments — `// <text>`

Lines starting with `//` are ignored entirely.

```
// This was a deload week
```

---

## Exercise syntax in depth

```
<name> <sets>x<reps> [@ <weight> [unit]]
```

### Reps

| Format | Meaning | Example |
|---|---|---|
| `N` | Same rep count every set | `3x5` → 3 sets of 5 |
| `[a,b,c,...]` | Different reps per set | `3x[5,3,1]` → 5, 3, 1 reps |
| `Nsec` | Timed sets (seconds) | `3x45sec` → 3 × 45-second holds |

The number of values in a rep list must match the set count.

### Weight

| Format | Meaning | Example |
|---|---|---|
| `@ N` | Same weight every set | `@ 135` |
| `@ [a,b,c,...]` | Different weight per set | `@ [135,155,185]` |
| *(omitted)* | Unspecified — defaults to `0` | `Pull Ups 3x8` |

Decimal weights are supported: `@ 22.5kg`.

The number of values in a weight list must match the set count.

### Unit

Append `lbs` or `kg` after the weight. Defaults to `lbs` when omitted. The unit can be placed after the closing bracket of a list or on any element within the list — the first unit found is used for all sets in that exercise.

```
Front Squat 3x5 @ [135,155,185]lbs
Hang Power Snatch 3x3 @ [55kg,60,65]
```

---

## Planning ahead

Because weight defaults to `0` when omitted, you can write a full session plan before the workout and fill in the weights afterward:

```
D: 06/15/25
S: PC 5x3, Pull Ups 3x6
Front Squat 4x5
BB RDL 3x8
Weighted Plank 3x45sec
```

After the session, add the weights and re-parse:

```
D: 06/15/25
S: PC 5x3 @ [100,105,110,115,120], Pull Ups 3x6
Front Squat 4x5 @ [185,195,205,215]
BB RDL 3x8 @ 135
Weighted Plank 3x45sec @ 25lbs
```

---

## Full example

```
D: 05/30/25
Front Squat 4x5 @ [100,110,120,120]
BB RDL 3x6 @ [70,90,100]
Broad Jump 3x3
Weighted Plank 3x30sec @ 25kg
```

```
D: 06/06/25
BB Bench 1x1 @ 260
S: Curls 3x[10,8,6] @ [40,45,50], Skull crushers 3x10 @ 60
KB Kneeling SA Military 3x8
N: Finisher — Nickels & Dimes EMOM, 9 rounds: 90 pushups / 42 pullups
```

```
D: 05/26/25
Hang Power Snatch 5x[3,3,2,1,3] @ [50,55,60,65,50]
S: BB Bench 4x5 @ [195,205,215,225], Two Way Palloff Press 2x4, DB Row 3x8
S: Kneeling KB to Military 3x6, Plated Deadbugs 3x12, KB Sidebends 3x6
```

---

## Grammar (EBNF)

```ebnf
(* ---------- Document ---------- *)
workout        = line , { newline , line } ;

line           = blank-line
               | comment-line
               | date-line
               | note-line
               | superset-line
               | exercise-line ;

(* ---------- Trivial lines ---------- *)
blank-line     = { ws } ;
comment-line   = { ws } , "//" , { any-char } ;

(* ---------- Special lines ---------- *)
date-line      = { ws } , "D:" , { ws } , date ;
note-line      = { ws } , "N:" , { ws } , free-text ;
superset-line  = { ws } , "S:" , { ws } ,
                 exercise-spec ,
                 { { ws } , "," , { ws } , exercise-spec } ;

(* ---------- Exercise ---------- *)
exercise-line  = { ws } , exercise-spec ;
exercise-spec  = exercise-name , ws , sets-reps , [ ws , weight-clause ] ;
exercise-name  = name-word , { ws , name-word } ;
name-word      = letter , { letter } ;

(* ---------- Sets × Reps ---------- *)
sets-reps      = sets , "x" , reps ;
sets           = integer ;
reps           = rep-count | rep-list | time-reps ;
rep-count      = integer ;
rep-list       = "[" , integer , { "," , integer } , "]" ;
time-reps      = integer , "sec" ;

(* ---------- Weight ---------- *)
weight-clause  = "@" , { ws } , weight-value , [ unit ] ;
weight-value   = weight-number | weight-list ;
weight-number  = integer ;
weight-list    = "[" , integer , { "," , integer } , "]" ;
unit           = "lbs" | "kg" ;

(* ---------- Date ---------- *)
date           = mm , "/" , dd , "/" , yy ;
mm             = digit , digit ;
dd             = digit , digit ;
yy             = digit , digit ;

(* ---------- Terminals ---------- *)
integer        = digit , { digit } ;
free-text      = { any-char } ;
ws             = ( " " | tab ) , { " " | tab } ;
newline        = "\n" | "\r\n" ;
letter         = "A".."Z" | "a".."z" ;
digit          = "0".."9" ;
any-char       = ? any character except newline ? ;
tab            = ? horizontal tab (U+0009) ? ;
```

> **Extensions beyond the grammar:** decimal weights are accepted (e.g. `22.5kg`), and the unit may appear on any element inside a weight list (e.g. `[100kg,105,110]`).

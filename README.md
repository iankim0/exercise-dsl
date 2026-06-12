# LIFT

Most workout apps get in the way. Tapping through menus, searching an exercise database, adjusting a slider for each set — by the time you've logged a warmup you've lost your rest time. They're built for browsing, not for athletes who already know what they're doing.

LIFT takes a different approach: you write your workout the same way you'd jot it on a whiteboard. One line per exercise, a consistent shorthand for sets and reps, and the app handles the rest. It's fast enough to log mid-session and flexible enough to plan a full week in advance.

**[Try it →](https://exercise-dsl.vercel.app)**

---

## The language

A session is plain text — one line per exercise. Write it before your workout as a plan, fill in weights after, or log everything in real time.

```
D: 06/15/25
N: Felt strong today
Front Squat 4x5 @ [185,195,205,215]
BB RDL 3x8 @ 135
S: Curls 3x10 @ 50, Skull crushers 3x10 @ 60
Weighted Plank 3x45sec @ 25lbs
```

### Date — `D: MM/DD/YY`

```
D: 06/15/25
```

### Exercise — `<name> <sets>x<reps> [@ <weight> [unit]]`

```
Front Squat 4x5 @ 185
```

Weight defaults to `0` when omitted — useful for writing a plan before you know what you'll lift. Decimals are supported (`@ 22.5kg`).

### Superset — `S: <exercise>, <exercise>, ...`

```
S: Curls 3x10 @ 50, Skull crushers 3x10 @ 60
```

### Note — `N: <free text>`

```
N: Felt strong today, consider bumping weight next session.
```

### Comments — `// <text>`

```
// Deload week
```

---

## Reps and weights

Both reps and weight accept either a single value (applied to all sets) or a bracketed list (one value per set).

| Format | Example | Meaning |
|---|---|---|
| Uniform | `3x5 @ 185` | 3 sets of 5 at 185 |
| Per-set reps | `3x[5,3,1] @ 225` | Sets of 5, 3, 1 |
| Per-set weight | `3x5 @ [185,195,205]` | Weight increases each set |
| Timed | `3x45sec` | 3 × 45-second holds |

Units are `lbs` (default) or `kg`. Place the unit after the number or anywhere inside a list — the first one found applies to all sets in that exercise.

```
Front Squat 3x5 @ [135,155,185]lbs
Hang Power Snatch 3x3 @ [55kg,60,65]
```

---

## Planning ahead

Because weight defaults to `0`, you can sketch a session before you lift and fill in the numbers after:

```
D: 06/15/25
Front Squat 4x5
BB RDL 3x8
Weighted Plank 3x45sec
```

Then after the session:

```
D: 06/15/25
Front Squat 4x5 @ [185,195,205,215]
BB RDL 3x8 @ 135
Weighted Plank 3x45sec @ 25lbs
```

---

## Full examples

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

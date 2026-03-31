# Adaptive Workout System - Configuration Reference

## Set Budgets by Goal

```javascript
MUSCLE_GAIN:           60 sets/week
STRENGTH:              40 sets/week
FAT_LOSS:              40 sets/week
ENDURANCE:             30 sets/week
ATHLETIC_PERFORMANCE: 45 sets/week
GENERAL_FITNESS:       45 sets/week
V_TAPER:               55 sets/week
HOURGLASS:             55 sets/week
```

## Recovery Tier Multipliers

```javascript
TIER 0 (Deload):       60% volume (Energy ≤3 OR poor sleep/high stress)
TIER 1 (Moderate):     85% volume (Mixed recovery signals)
TIER 2 (Strong):       100% volume (Energy ≥7 AND good sleep/low stress)
```

## Rep Ranges by Goal & Experience

### Muscle Gain (Hypertrophy)
- Beginner:      8–12 reps
- Intermediate:  6–12 reps
- Advanced:      5–10 reps

### Strength
- Beginner:      6–8 reps
- Intermediate:  3–6 reps
- Advanced:      1–5 reps

### Fat Loss
- Beginner:      10–15 reps
- Intermediate:  8–12 reps
- Advanced:      6–10 reps

### Endurance
- Beginner:      15–20 reps
- Intermediate:  12–18 reps
- Advanced:      10–15 reps

### Athletic Performance
- Beginner:      6–10 reps
- Intermediate:  5–8 reps
- Advanced:      3–6 reps

### General Fitness
- Beginner:      8–12 reps
- Intermediate:  8–10 reps
- Advanced:      6–8 reps

### V-Taper
- Beginner:      6–10 reps
- Intermediate:  5–8 reps
- Advanced:      3–6 reps

### Hourglass
- Beginner:      8–12 reps
- Intermediate:  6–10 reps
- Advanced:      5–8 reps

---

## Muscle Allocation by Goal

### Muscle Gain (Balanced)
```
Chest:      8 sets
Back:       8 sets
Shoulders:  6 sets
Arms:       6 sets
Legs:      10 sets
Core:       2 sets
─────────────────
Total:     40 sets (normalized units)
```

### Strength (Lower Emphasis)
```
Chest:      7 sets
Back:       8 sets
Shoulders:  5 sets
Arms:       3 sets
Legs:      12 sets
Core:       1 set
─────────────────
Total:     36 sets
```

### Fat Loss (Moderate Legs)
```
Chest:      6 sets
Back:       7 sets
Shoulders:  5 sets
Arms:       4 sets
Legs:       9 sets
Core:       3 sets
─────────────────
Total:     34 sets
```

### Endurance (Heavy Legs)
```
Chest:      4 sets
Back:       5 sets
Shoulders:  4 sets
Arms:       2 sets
Legs:      12 sets
Core:       1 set
─────────────────
Total:     28 sets
```

### Athletic Performance (Balanced)
```
Chest:      6 sets
Back:       7 sets
Shoulders:  7 sets
Arms:       3 sets
Legs:      10 sets
Core:       2 sets
─────────────────
Total:     35 sets
```

### General Fitness (Slight Lower)
```
Chest:      5 sets
Back:       5 sets
Shoulders:  5 sets
Arms:       4 sets
Legs:       8 sets
Core:       3 sets
─────────────────
Total:     30 sets
```

### V-Taper (Back & Shoulders Heavy)
```
Chest:      6 sets
Back:      10 sets ⬆️ (PRIMARY - Lat width)
Shoulders: 12 sets ⬆️ (PRIMARY - Shoulder caps)
Arms:       5 sets
Legs:       6 sets
Core:       2 sets
─────────────────
Total:     41 sets
```

### Hourglass (Glutes & Shoulders Heavy)
```
Chest:      4 sets
Back:       5 sets
Shoulders:  8 sets ⬆️ (PRIMARY - Width)
Arms:       3 sets
Legs:       5 sets
Glutes:    14 sets ⬆️ (PRIMARY - Shape/Size)
Core:       3 sets
─────────────────
Total:     42 sets
```

---

## Training Frequency Splits

### 1x/Week
**Split:** Full Body Minimal
```
Mon: Complete Workout (All muscle groups)
Tue-Sun: Rest
```

### 2x/Week
**Split:** Full Body A/B
```
Mon: Full Body A
Tue-Wed: Rest
Thu: Full Body B
Fri-Sun: Rest
```

### 3x/Week (Most Popular)
**Split:** Push/Pull/Legs
```
Mon: Push (Chest, Shoulders, Triceps)
Tue-Wed: Rest
Wed: Pull (Back, Biceps)
Thu-Fri: Rest
Fri: Legs (Quads, Hamstrings, Calves)
Sat-Sun: Rest
```

### 4x/Week (Standard)
**Split:** Upper/Lower
```
Mon: Upper A (Push focus)
Tue: Lower A (Squat focus)
Tue-Wed: Rest
Thu: Upper B (Pull focus)
Fri: Lower B (Hinge focus)
Sat-Sun: Rest
```

### 5x/Week (Advanced)
**Split:** Upper/Lower + Focus
```
Mon: Upper A
Tue: Lower A
Wed: Rest
Thu: Upper B
Fri: Lower B
Sat: Focus Day (Weak points)
Sun: Rest
```

### 6x/Week (High Frequency)
**Split:** Push/Pull/Legs × 2
```
Mon: Push
Tue: Pull
Wed: Legs
Thu: Rest
Fri: Push
Sat: Pull
Sun: Legs
```

### 7x/Week (Elite Athletes)
**Split:** Full Splits Daily
```
Mon: Push
Tue: Pull
Wed: Legs
Thu: Full Body
Fri: Push
Sat: Pull
Sun: Legs + Focus
```

---

## Sets Per Session Calculation

```
Formula: Weekly Budget ÷ Training Frequency = Sets Per Session

Examples:
─────────────────────────────────────────
Muscle Gain (60 sets) + 3x/week = 20 sets/session
Muscle Gain (60 sets) + 4x/week = 15 sets/session
Muscle Gain (60 sets) + 6x/week = 10 sets/session

Strength (40 sets) + 4x/week = 10 sets/session
Strength (40 sets) + 3x/week = 13 sets/session

V-Taper (55 sets) + 4x/week = 14 sets/session
Hourglass (55 sets) + 4x/week = 14 sets/session
```

---

## Deload Protocol (Tier 0)

When recovery is poor (energy ≤3):

```
Volume Adjustment:     60% of normal
Intensity:            50-60% of normal weight
RPE (Rate of Exertion): 4-5/10
Reps Target:          Same rep range, lighter weight
Rest Periods:         2-3 min compounds, 60-90s isolation
Session Length:       30-40 minutes
Frequency:            No change in training frequency
Sleep Goal:           +1 hour extra
Supplements:          Magnesium 400mg, Vitamin D 2000IU
Cardio:               None (full focus on recovery)
```

---

## Periodization: 8-Week Cycle

```
Week 1-5: HYPERTROPHY BLOCK
├─ Rep Range: Higher (8–12 or similar)
├─ Sets: Full budget
├─ Rest: 60-90s
└─ Focus: Muscle damage & volume

Week 6-8: STRENGTH BLOCK
├─ Rep Range: Lower (3–6 or similar)
├─ Sets: 80-90% of hypertrophy sets
├─ Rest: 3-5 min
└─ Focus: Max strength gains

Then repeat...
```

---

## Exercise Categories

### Compound Exercises (Heavy)
- Squats, Deadlifts, Bench Press
- Rows, Pull-Ups, Overhead Press
- Take priority (go first)
- Lower reps, longer rest
- Max effort on these

### Isolation Exercises (Moderate)
- Leg Curls, Chest Fly, Lateral Raises
- Curls, Extensions
- Supplement compounds
- Higher reps, shorter rest
- Control & feel

---

## Quick Reference: Budget Adjustments

```
Goal:              Budget    Avg Per Session (4×/week)
──────────────────────────────────────
Muscle Gain        60        15 sets
Strength           40        10 sets
Fat Loss           40        10 sets
Endurance          30        7–8 sets
Athletic           45        11 sets
General            45        11 sets
V-Taper            55        14 sets
Hourglass          55        14 sets

With Recovery Tiers (4×/week):
Deload (×0.6):    36        9 sets
Moderate (×0.85):  51        13 sets
Strong (×1.0):     60        15 sets
```

---

## Example: Full Plan for Hourglass + 4 Days

```
PROFILE:
Goal:              Hourglass
Days:              4×/week
Experience:        Intermediate
Recovery Tier:     Strong (2)

PLAN SUMMARY:
Weekly Budget:     55 sets
Sets/Session:      14 sets
Rep Range:         6–10 (for compounds), 8–12 (isolation)
Split:             Upper/Lower (Glute Focus)
Block:             Hypertrophy Week 1

MUSCLE ALLOCATION:
Glutes:            14 sets (primary)
Shoulders:         8 sets
Legs (Quad/Ham):   5 sets
Back:              5 sets
Chest:             4 sets
Arms:              3 sets
Core:              3 sets

WEEKLY SCHEDULE:
Monday:    Lower A - Glute Focus (14 sets)
Tuesday:   Upper - Shoulders & Back (14 sets)
Wednesday: Rest
Thursday:  Lower B - Hamstring & Quad (14 sets)
Friday:    Upper - Shoulders & Back (14 sets)
Saturday:  REST
Sunday:    REST

SESSIONS:
Lower A (Monday):
├─ Hip Thrust 4×6–10
├─ Sumo Deadlift 3×6–10
├─ Bulgarian Split Squat 3×8–12
├─ Cable Kickback 2×10–15
└─ Glute Abductor 2×12–15

Upper (Tuesday):
├─ Lateral Raise 3×8–12
├─ Overhead Press 3×6–10
├─ Pull-Up 3×6–10
├─ Bent Over Row 3×8–12
└─ Bicep Curl 2×8–12

Lower B (Thursday):
├─ Romanian Deadlift 3×8–12
├─ Leg Curl 3×10–15
├─ Leg Press 3×6–10
├─ Bulgarian Split Squat 2×8–12
└─ Calf Raise 2×12–15

Upper (Friday):
├─ Arnold Press 3×6–10
├─ Lateral Raise 3×8–12
├─ Lat Pulldown 3×6–10
├─ Cable Row 3×8–12
└─ Concentration Curl 2×8–12
```

---

## Code Reference

```javascript
// Access engine
const engine = window.AdaptivePlanningEngine;

// Available properties
engine.SET_BUDGETS          // Goal budgets
engine.VOLUME_ADJUSTMENTS   // Tier multipliers
engine.REP_RANGES          // Rep ranges by goal/experience

// Available methods
engine.getMuscleAllocation(goal)
engine.getRepRange(goal, experience, isIsolation)
engine.calculateWeeklyBudget(goal, tier)
engine.calculateSetsPerSession(budget, frequency)
engine.getRecommendedSplit(frequency, goal)
engine.getExercisesForGoal(goal, equipment)
engine.calculateRecoveryTier(energy, stress, sleep)
engine.generatePlanSummary(profile, checkin, weekNum)
```

---

## Configuration Files

| File | Purpose |
|------|---------|
| `adaptive-planning-engine.js` | Core engine (all functions) |
| `ADAPT_APP_INTEGRATION.md` | Integration guide |
| `SETUP_GUIDE.md` | Setup instructions |
| `CONFIGURATION_REFERENCE.md` | This file - all values |

---

All 56 configurations are supported! ✅


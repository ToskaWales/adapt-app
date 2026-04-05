/**
 * Pure fitness-calculation helpers.
 * Exported here so they can be imported by both app.js and test files.
 */

/**
 * Mifflin-St Jeor BMR calculation.
 * @param {{ weight: number, height: number, age: number, sex: string }} params
 * @returns {number} BMR in kcal/day (rounded to nearest integer)
 */
export function calculateBMR({ weight, height, age, sex }) {
  const sAdj = sex === 'female' ? -161 : 5;
  return Math.round(10 * weight + 6.25 * height - 5 * age + sAdj);
}

/**
 * Determine whether an auto-deload should be triggered from recent check-in
 * and session data.
 *
 * @param {{ recentCheckins?: object[], recentSessions?: object[] }} params
 * @returns {string|null} Reason string if deload should trigger, or null
 */
export function shouldAutoDeload({ recentCheckins = [], recentSessions = [] } = {}) {
  const regressions = recentCheckins.filter((c) => c.lifts === 'regressed').length;
  const lowEnergyCount = recentCheckins.filter(
    (c) => parseInt(c.energy, 10) <= 4
  ).length;
  const avgStress =
    recentCheckins.length
      ? recentCheckins.reduce((a, c) => a + (parseInt(c.stress, 10) || 0), 0) /
        recentCheckins.length
      : 0;

  let stallCount = 0;
  const bestByExercise = {};
  [...recentSessions].reverse().forEach((sess) => {
    (sess.exercises || []).forEach((ex) => {
      const prev = bestByExercise[ex.name] || 0;
      if (ex.maxWeight <= prev) stallCount++;
      bestByExercise[ex.name] = Math.max(prev, ex.maxWeight || 0);
    });
  });

  if (regressions >= 2 && lowEnergyCount >= 2)
    return 'Deload auto-triggered: two regressed check-ins plus low energy.';
  if (regressions >= 2 && avgStress >= 7)
    return 'Deload auto-triggered: repeated regressions with high stress.';
  if (stallCount >= 8 && lowEnergyCount >= 1)
    return 'Deload auto-triggered: stalled top sets across recent sessions.';
  return null;
}

const ALL_MUSCLES = ['chest','back','shoulders','biceps','triceps','glutes','quads','hamstrings','calves','core'];

// Tuning constants for the per-muscle adaptive layer
const SORENESS_PENALTY_MULTIPLIER = 0.55;
const REGRESSION_PENALTY = 0.15;
const OVERLOAD_BONUS = 0.1;
const FULL_RECOVERY_DAYS = 3;

/**
 * Compute a per-muscle recovery score (0–1.1) from recent check-ins and sessions.
 *
 * Score interpretation:
 *  < 0.4  — very fatigued / not recovered
 *  0.4–0.7 — partially recovered
 *  0.7–1.0 — well recovered
 *  > 1.0  — consistently progressing (bonus for overload)
 *
 * Factors:
 *  1. Days since the muscle was last trained (full recovery assumed at 3+ days)
 *  2. Soreness reports in check-ins after the last session for that muscle
 *  3. Weight/performance trend on that muscle's exercises across recent sessions
 *
 * @param {object[]} checkins - Recent check-ins (newest-first), may include `sorenessAreas: string[]`
 * @param {object[]} sessions - Recent sessions with `exercises[].muscle` and `exercises[].maxWeight`
 * @param {string|null} nowIso - ISO date string for "today" (defaults to current date)
 * @returns {Record<string, number>} Map of muscle → recovery score
 */
export function getMuscleRecoveryMap(checkins = [], sessions = [], nowIso = null) {
  const today = nowIso || new Date().toISOString().split('T')[0];
  const todayMs = new Date(today).getTime();
  const result = {};

  const sortedSessions = [...sessions]
    .filter(s => s.isoDate)
    .sort((a, b) => b.isoDate.localeCompare(a.isoDate));

  const sortedCheckins = [...checkins]
    .filter(c => c.isoDate)
    .sort((a, b) => b.isoDate.localeCompare(a.isoDate));

  for (const muscle of ALL_MUSCLES) {
    const lastMuscleSess = sortedSessions.find(s =>
      (s.exercises || []).some(ex => ex.muscle === muscle)
    );

    // Days since last trained — default to 7 (well recovered) if never trained
    let daysSince = 7;
    if (lastMuscleSess) {
      daysSince = (todayMs - new Date(lastMuscleSess.isoDate).getTime()) / 86400000;
    }

    // Base recovery from elapsed time (0 at 0 days, 1.0 at ≥ FULL_RECOVERY_DAYS days)
    let recovery = Math.min(1.0, daysSince / FULL_RECOVERY_DAYS);

    // Soreness penalty: any check-in after last session that flags this muscle
    const lastSessDate = lastMuscleSess?.isoDate || '';
    const hasSorenessReport = sortedCheckins.some(c =>
      c.isoDate > lastSessDate &&
      Array.isArray(c.sorenessAreas) &&
      c.sorenessAreas.includes(muscle)
    );
    if (hasSorenessReport) recovery *= SORENESS_PENALTY_MULTIPLIER;

    // Performance trend: compare maxWeight across up to 3 recent sessions for this muscle
    const muscleSessions = sortedSessions
      .filter(s => (s.exercises || []).some(ex => ex.muscle === muscle))
      .slice(0, 3);

    if (muscleSessions.length >= 2) {
      const exNames = [...new Set(
        muscleSessions.flatMap(s =>
          (s.exercises || []).filter(ex => ex.muscle === muscle).map(ex => ex.name)
        )
      )];
      let improving = 0;
      let regressing = 0;
      for (const exName of exNames) {
        const w0 = (muscleSessions[0].exercises || []).find(e => e.name === exName)?.maxWeight || 0;
        const w1 = (muscleSessions[1].exercises || []).find(e => e.name === exName)?.maxWeight || 0;
        if (w0 > 0 && w1 > 0) {
          if (w0 > w1) improving++;
          else if (w0 < w1) regressing++;
        }
      }
      // Consistent 3-session improvement → small bonus (overload candidate)
      if (improving > regressing && muscleSessions.length >= 3) {
        const anyChain = exNames.some(exName => {
          const w1 = (muscleSessions[1].exercises || []).find(e => e.name === exName)?.maxWeight || 0;
          const w2 = (muscleSessions[2].exercises || []).find(e => e.name === exName)?.maxWeight || 0;
          return w1 > 0 && w2 > 0 && w1 > w2;
        });
        if (anyChain) recovery = Math.min(1.0 + OVERLOAD_BONUS, recovery + OVERLOAD_BONUS);
      }
      // Regression trend → small penalty
      if (regressing > improving) recovery = Math.max(0, recovery - REGRESSION_PENALTY);
    }

    result[muscle] = Math.max(0, Math.min(1.0 + OVERLOAD_BONUS, recovery));
  }
  return result;
}

/**
 * Return a set-count multiplier for a muscle based on its recovery state and soreness.
 *
 * Multiplier table:
 *  isSore || recovery < 0.4   → 0.6  (significant volume reduction)
 *  recovery 0.4–0.7           → 0.85 (moderate reduction)
 *  recovery 0.7–1.0           → 1.0  (full prescribed volume)
 *  recovery > 1.0             → 1.1  (progressive overload bonus)
 *
 * @param {string} muscle
 * @param {Record<string, number>} recoveryMap - Output of getMuscleRecoveryMap
 * @param {string[]} sorenessAreas - Muscles the user flagged as sore today
 * @returns {number} Multiplier to apply to the per-session set budget
 */
export function getMuscleVolumeModifier(muscle, recoveryMap = {}, sorenessAreas = []) {
  const recovery = recoveryMap[muscle] ?? 1.0;
  const isSore = (sorenessAreas || []).includes(muscle);
  if (isSore || recovery < 0.4) return 0.6;
  if (recovery < 0.7) return 0.85;
  if (recovery > 1.0) return 1.0 + OVERLOAD_BONUS;
  return 1.0;
}

/**
 * Adapt a base scheme string (e.g. "3×8–12") based on recent performance on a specific
 * exercise and today's muscle soreness.
 *
 * Behaviour:
 *  - Consistently hitting top of rep range (last 2 sessions): push range up by 1–2 reps
 *  - Consistently missing bottom of rep range (last 2 sessions): reduce sets by 1
 *  - Muscle is sore today: reduce sets by 1 (keep lower end of range)
 *  - Otherwise: return base scheme unchanged
 *
 * Set count is never reduced below 2.
 *
 * @param {string} baseSch - Base scheme, e.g. "3×8–12" or "3×30–45s"
 * @param {string} exName - Exercise name key (matches session exercise.name)
 * @param {object[]} sessions - Recent sessions to look up exercise history
 * @param {string[]} sorenessAreas - Muscles flagged as sore today
 * @param {string} muscle - Muscle group for the exercise
 * @returns {string} Adjusted scheme string
 */
export function getAdaptiveScheme(baseSch, exName, sessions = [], sorenessAreas = [], muscle = '') {
  if (!baseSch || !exName) return baseSch;
  const match = String(baseSch).match(/^(\d+)×(.+)$/);
  // Leave non-standard schemes (e.g. time-based) unchanged
  if (!match || /[a-zA-Z]/.test(match[2])) return baseSch;

  const origSets = parseInt(match[1]);
  const repRange = match[2];
  const isSore = (sorenessAreas || []).includes(muscle);

  // Parse rep range — support both '–' (en-dash) and '-' (hyphen)
  const rangeParts = repRange.includes('–') ? repRange.split('–') : repRange.split('-');
  const lo = parseInt(rangeParts[0]) || 8;
  const hi = parseInt(rangeParts[1]) || lo + 4;

  // Look up the last 4 sessions containing this exercise (newest-first)
  const recent = [...sessions]
    .filter(s => s.isoDate)
    .sort((a, b) => b.isoDate.localeCompare(a.isoDate))
    .slice(0, 4);
  const exData = recent
    .map(s => (s.exercises || []).find(e => e.name === exName))
    .filter(Boolean);

  if (exData.length >= 2) {
    const last2 = exData.slice(0, 2);
    const hittingTop = last2.every(e => (e.maxReps || 0) >= hi);
    const missingTarget = last2.every(e => e.maxReps > 0 && e.maxReps < lo - 1);

    if (hittingTop && !isSore) {
      // Ready for progressive overload — push rep range up
      return `${origSets}×${lo + 1}–${hi + 2}`;
    }
    if (missingTarget || isSore) {
      // Not hitting target or muscle is sore — reduce sets
      return `${Math.max(origSets - 1, 2)}×${lo}–${hi}`;
    }
  }

  // No history but muscle is sore — still reduce sets
  if (isSore) {
    return `${Math.max(origSets - 1, 2)}×${lo}–${hi}`;
  }

  return baseSch;
}

/**
 * Build the enhanced ML feature vector (v2) for a single check-in.
 * Includes bias term, current check-in signals, day-of-week, and
 * rolling 3-day average energy/stress from prior check-ins.
 *
 * @param {object} c - Current check-in
 * @param {object[]} priorCheckins - Up to 3 most-recent prior check-ins
 * @returns {number[]}
 */
export function mlFeatureVecV2(c, priorCheckins = []) {
  const mlSleepVal = (v) =>
    ({ '<5hrs': 0, '5-6hrs': 0.35, '7-8hrs': 0.75, '8+hrs': 1 }[v] ?? 0.5);
  const mlLiftVal = (v) =>
    ({ regressed: 0, same: 0.45, slightly_up: 0.72, pbs: 1 }[v] ?? 0.5);
  const mlDietVal = (v) =>
    ({ way_under: 0.15, under: 0.4, on_target: 0.85, over: 0.35 }[v] ?? 0.5);

  // Day-of-week: 0 = Monday, 6 = Sunday, normalised 0–1
  // Default to Wednesday (3) when isoDate is absent — a neutral mid-week value
  const dow = c.isoDate ? (new Date(c.isoDate).getDay() + 6) % 7 : 3;
  const dowNorm = dow / 6;

  // Rolling 3-day averages from prior check-ins (0–1 scale)
  const recent = priorCheckins.slice(-3);
  const rollEnergy =
    recent.length
      ? recent.reduce((s, x) => s + (parseFloat(x.energy) || 5), 0) /
        recent.length /
        10
      : (parseFloat(c.energy) || 5) / 10;
  const rollStress =
    recent.length
      ? 1 -
        recent.reduce((s, x) => s + (parseFloat(x.stress) || 5), 0) /
          recent.length /
          10
      : 1 - (parseFloat(c.stress) || 5) / 10;

  return [
    1, // bias
    Math.max(0, Math.min(1, (parseFloat(c.energy) || 5) / 10)),
    Math.max(0, Math.min(1, 1 - (parseFloat(c.stress) || 5) / 10)),
    mlSleepVal(c.sleep),
    mlLiftVal(c.lifts),
    mlDietVal(c.diet),
    Math.max(0, Math.min(1, (parseFloat(c.weight) || 75) / 140)),
    dowNorm,
    rollEnergy,
    rollStress,
  ];
}

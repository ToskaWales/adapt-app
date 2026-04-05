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

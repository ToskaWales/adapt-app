/**
 * Menstrual cycle phase inference, feature extraction, and symptom modifiers.
 * All functions are pure — no side effects, no I/O.
 *
 * Design principles (per evidence-based design doc):
 *  - Cycle phase is a contextual signal, not the whole program.
 *  - Phase info only reduces tier; it never raises it alone.
 *  - Hormonal contraception and irregular cycles get low/zero phase confidence.
 *  - Symptoms and readiness remain the primary drivers.
 */

export const CYCLE_PROFILES = {
  EUMENORRHEIC: 'eumenorrheic',
  HORMONAL_CONTRACEPTION: 'hormonal_contraception',
  IRREGULAR: 'irregular',
  PERIMENOPAUSE: 'perimenopause',
  NOT_APPLICABLE: 'not_applicable',
};

export const CYCLE_PHASES = {
  MENSTRUAL: 'menstrual',
  EARLY_FOLLICULAR: 'early_follicular',
  OVULATORY: 'ovulatory',
  EARLY_LUTEAL: 'early_luteal',
  LATE_LUTEAL: 'late_luteal',
  UNKNOWN: 'unknown',
};

/**
 * Compute average cycle length in days from logged period start dates.
 * Uses up to the last 6 cycle intervals. Returns null if fewer than 2 logs.
 *
 * @param {object[]} cycleLogs - Array of { startDate: 'YYYY-MM-DD', endDate?: string }
 * @returns {number|null}
 */
export function calcAvgCycleLength(cycleLogs = []) {
  const starts = [...cycleLogs]
    .filter(l => l.startDate)
    .map(l => new Date(l.startDate).getTime())
    .sort((a, b) => a - b);
  if (starts.length < 2) return null;
  const intervals = [];
  for (let i = 1; i < Math.min(starts.length, 7); i++) {
    const days = (starts[i] - starts[i - 1]) / 86400000;
    if (days >= 18 && days <= 60) intervals.push(days);
  }
  if (!intervals.length) return null;
  return intervals.reduce((s, v) => s + v, 0) / intervals.length;
}

/**
 * Compute cycle length variability (std dev of inter-period intervals in days).
 * Returns null if fewer than 3 cycles logged.
 *
 * @param {object[]} cycleLogs
 * @returns {number|null}
 */
export function calcCycleLengthVariability(cycleLogs = []) {
  const starts = [...cycleLogs]
    .filter(l => l.startDate)
    .map(l => new Date(l.startDate).getTime())
    .sort((a, b) => a - b);
  if (starts.length < 3) return null;
  const intervals = [];
  for (let i = 1; i < Math.min(starts.length, 7); i++) {
    const days = (starts[i] - starts[i - 1]) / 86400000;
    if (days >= 18 && days <= 60) intervals.push(days);
  }
  if (intervals.length < 2) return null;
  const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
  const variance = intervals.reduce((s, v) => s + (v - avg) ** 2, 0) / intervals.length;
  return Math.sqrt(variance);
}

/**
 * Infer the current menstrual cycle phase from logged periods.
 *
 * Phase boundaries are approximate calendar estimates — not hormone measurements.
 * Confidence is reduced for irregular cycles, limited log history, or when the
 * current cycle day exceeds the user's expected cycle length.
 *
 * @param {object[]} cycleLogs - Array of { startDate: 'YYYY-MM-DD', endDate?: string }
 * @param {string} cycleProfile - One of CYCLE_PROFILES values
 * @param {string|null} todayIso - ISO date for today (defaults to now)
 * @returns {{
 *   phase: string,
 *   cycleDay: number|null,
 *   confidence: number,
 *   daysSinceLastBleed: number|null,
 *   avgCycleLength: number|null,
 *   variability: number|null,
 *   cycleAbsenceFlag: boolean,
 *   isIrregular: boolean,
 *   phaseNote: string|null
 * }}
 */
export function inferCyclePhase(cycleLogs = [], cycleProfile = 'eumenorrheic', todayIso = null) {
  const today = todayIso ? new Date(todayIso) : new Date();
  const todayMs = today.getTime();
  const fallback = {
    phase: CYCLE_PHASES.UNKNOWN,
    cycleDay: null,
    confidence: 0,
    daysSinceLastBleed: null,
    avgCycleLength: null,
    variability: null,
    cycleAbsenceFlag: false,
    isIrregular: false,
    phaseNote: null,
  };

  if (!cycleProfile || cycleProfile === CYCLE_PROFILES.NOT_APPLICABLE) return fallback;

  if (cycleProfile === CYCLE_PROFILES.HORMONAL_CONTRACEPTION) {
    // Pill bleeds don't reflect endogenous hormone cycling — skip phase inference
    return {
      ...fallback,
      phaseNote: 'Hormonal contraception active — calendar phase inference skipped.',
    };
  }

  const sortedLogs = [...cycleLogs]
    .filter(l => l.startDate)
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

  if (!sortedLogs.length) {
    return {
      ...fallback,
      cycleAbsenceFlag: true,
    };
  }

  const lastStart = new Date(sortedLogs[0].startDate);
  const lastEnd = sortedLogs[0].endDate ? new Date(sortedLogs[0].endDate) : null;
  const daysSinceLastBleed = (todayMs - lastStart.getTime()) / 86400000;
  const cycleAbsenceFlag = daysSinceLastBleed > 90;

  const avgCycleLength = calcAvgCycleLength(cycleLogs) ?? 28;
  const variability = calcCycleLengthVariability(cycleLogs);

  const isIrregular =
    cycleProfile === CYCLE_PROFILES.IRREGULAR ||
    cycleProfile === CYCLE_PROFILES.PERIMENOPAUSE ||
    (variability !== null && variability > 7);

  const cycleDay = Math.max(1, Math.round(daysSinceLastBleed) + 1);

  // Confidence degrades with distance past expected next period, irregular cycles, limited history
  let confidence = 1.0;
  if (cycleDay > avgCycleLength + 5) confidence = 0.3;
  else if (cycleDay > avgCycleLength) confidence = 0.6;
  if (isIrregular) confidence *= 0.5;
  if (sortedLogs.length < 2) confidence *= 0.7;
  confidence = Math.max(0, Math.min(1, confidence));

  // Assume period lasts at most 7 days when no explicit endDate is logged
  const DEFAULT_BLEED_DAYS = 7;
  const isStillBleeding = lastEnd
    ? todayMs <= lastEnd.getTime()
    : daysSinceLastBleed < DEFAULT_BLEED_DAYS;
  let phase;
  if (isStillBleeding || cycleDay <= 5) {
    phase = CYCLE_PHASES.MENSTRUAL;
  } else if (cycleDay <= 12) {
    phase = CYCLE_PHASES.EARLY_FOLLICULAR;
  } else if (cycleDay <= 15) {
    phase = CYCLE_PHASES.OVULATORY;
  } else if (cycleDay <= 21) {
    phase = CYCLE_PHASES.EARLY_LUTEAL;
  } else {
    phase = CYCLE_PHASES.LATE_LUTEAL;
  }

  return {
    phase,
    cycleDay,
    confidence,
    daysSinceLastBleed,
    avgCycleLength,
    variability,
    cycleAbsenceFlag,
    isIrregular,
    phaseNote: null,
  };
}

/**
 * Return a soft tier modifier based on cycle phase and logged symptoms.
 *
 * The cycle signal only reduces tier — it never raises it alone.
 * Requires confidence >= 0.4 to apply any change (below that, phase label
 * is too uncertain to act on).
 *
 * @param {string} phase - Current phase from CYCLE_PHASES
 * @param {number} crampSeverity - 0–5 scale (0 = none, 5 = severe)
 * @param {string[]} cycleSymptoms - e.g. ['fatigue', 'bloating', 'mood', 'headache']
 * @param {number} confidence - Phase confidence 0–1
 * @returns {{ tierDelta: number, note: string|null, isApplied: boolean }}
 */
export function getCycleSymptomModifier(phase, crampSeverity = 0, cycleSymptoms = [], confidence = 0) {
  if (confidence < 0.4) return { tierDelta: 0, note: null, isApplied: false };

  const hasSevereCramps = crampSeverity >= 4;
  const hasModerateCramps = crampSeverity >= 2;
  const hasFatigue = cycleSymptoms.includes('fatigue');

  if (phase === CYCLE_PHASES.MENSTRUAL && hasSevereCramps && hasFatigue) {
    return {
      tierDelta: -1,
      note: 'Severe cramps and fatigue logged — intensity reduced. Cycle phase was a secondary factor; sleep and energy are the primary signals.',
      isApplied: true,
    };
  }
  if (phase === CYCLE_PHASES.MENSTRUAL && hasSevereCramps) {
    return {
      tierDelta: -1,
      note: 'Severe cramps logged — lighter session offered to keep you moving without added stress.',
      isApplied: true,
    };
  }
  if (phase === CYCLE_PHASES.LATE_LUTEAL && hasModerateCramps && hasFatigue) {
    return {
      tierDelta: -1,
      note: 'Pre-menstrual fatigue and cramps logged — load pulled back to support consistency over this phase.',
      isApplied: true,
    };
  }

  return { tierDelta: 0, note: null, isApplied: false };
}

/**
 * Build 4 normalised cycle-related ML features for appending to the feature vector.
 *
 * Features:
 *  [0] Phase position (0 = menstrual … 0.9 = late luteal, 0.5 = unknown/neutral)
 *  [1] Phase confidence (0–1)
 *  [2] Cycle day normalised to avg cycle length (0–1)
 *  [3] Cramp severity normalised (0–1, from 0–5 input)
 *
 * @param {object} cycleInference - Output of inferCyclePhase
 * @param {number} crampSeverity - 0–5
 * @returns {number[]} Always returns exactly 4 values
 */
export function buildCycleFeatures(cycleInference = {}, crampSeverity = 0) {
  const phaseToNum = {
    [CYCLE_PHASES.MENSTRUAL]: 0.0,
    [CYCLE_PHASES.EARLY_FOLLICULAR]: 0.2,
    [CYCLE_PHASES.OVULATORY]: 0.45,
    [CYCLE_PHASES.EARLY_LUTEAL]: 0.7,
    [CYCLE_PHASES.LATE_LUTEAL]: 0.9,
    [CYCLE_PHASES.UNKNOWN]: 0.5,
  };
  const phaseNum = phaseToNum[cycleInference.phase] ?? 0.5;
  const conf = cycleInference.confidence ?? 0;
  const cycleDayNorm =
    cycleInference.cycleDay != null
      ? Math.min(1, cycleInference.cycleDay / (cycleInference.avgCycleLength || 28))
      : 0.5;
  const crampNorm = Math.min(1, (crampSeverity || 0) / 5);
  return [phaseNum, conf, cycleDayNorm, crampNorm];
}

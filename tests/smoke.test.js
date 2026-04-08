import { describe, expect, it } from 'vitest';

import { getGoogleLoginErrorMessage, shouldPreferGoogleRedirect } from '../src/modules/auth.js';
import { calculateBMR, mlFeatureVecV2, shouldAutoDeload } from '../src/modules/fitness.js';
import { getGoalAdherenceInsights, getWeeklyProgressSummary } from '../src/modules/insights.js';
import { APP_I18N } from '../src/modules/i18n.js';
import {
  buildFirstRunChecklist,
  buildFirstRunEmptyState,
  getRecommendedFocusMuscles,
  getRecommendedTrainingSetup,
} from '../src/modules/onboarding.js';
import { formatLastSyncedLabel } from '../src/modules/ui.js';

describe('login helpers', () => {
  it('prefers redirect on GitHub Pages and iPhone browsers', () => {
    expect(
      shouldPreferGoogleRedirect(
        { hostname: 'toskawales.github.io' },
        { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' },
        () => ({ matches: false })
      )
    ).toBe(true);
  });

  it('explains unauthorized domain failures clearly', () => {
    expect(getGoogleLoginErrorMessage({ code: 'auth/unauthorized-domain' }, 'toskawales.github.io')).toContain(
      'Authorized domains'
    );
  });
});

describe('onboarding and home smoke coverage', () => {
  it('builds a clear first-run checklist', () => {
    const checklist = buildFirstRunChecklist({
      trainingDays: ['Mon', 'Wed', 'Fri'],
      sessionLen: 45,
      saunaGoal: 'recovery',
      saunaDays: ['Tue', 'Sat'],
      reminderSummary: 'Check-In · Sauna',
    });

    expect(checklist).toHaveLength(4);
    expect(buildFirstRunEmptyState({ goal: 'strength', trainingDays: ['Mon', 'Wed', 'Fri'] })).toContain(
      'First Week Game Plan'
    );

    const focus = getRecommendedFocusMuscles({ goal: 'vtaper' });
    const setup = getRecommendedTrainingSetup({ goal: 'strength', experience: 'advanced', consistency: 'locked_in' });

    expect(focus).toEqual(['back', 'shoulders']);
    expect(setup.splitPreset).toBe('upperlower');
    expect(setup.trainingDays.length).toBeGreaterThanOrEqual(4);
  });

  it('summarises weekly progress and adherence from trend data', () => {
    const checkins = [
      { createdAt: Date.now(), energy: 8, diet: 'on_target', lifts: 'pbs', weight: 82.2 },
      { createdAt: Date.now() - 86400000, energy: 7, diet: 'on_target', lifts: 'slightly_up', weight: 82.0 },
      { createdAt: Date.now() - 2 * 86400000, energy: 7, diet: 'under', lifts: 'same', weight: 81.8 },
    ];
    const sessions = [
      { createdAt: Date.now(), dayName: 'Upper A' },
      { createdAt: Date.now() - 2 * 86400000, dayName: 'Lower A' },
    ];
    const activities = [{ createdAt: Date.now(), duration: 30 }];

    const summary = getWeeklyProgressSummary({ checkins, sessions, activities, now: Date.now() });
    const adherence = getGoalAdherenceInsights(checkins, { dietGoal: 'maintain' }, Date.now());

    expect(summary.gymSessions).toBe(2);
    expect(summary.checkins).toBe(3);
    expect(adherence.score).toBeGreaterThan(0);
  });

  it('formats sync status labels for settings UI', () => {
    expect(formatLastSyncedLabel({ status: 'saved', ts: Date.now() - 60000 }, Date.now())).toContain('Last synced');
    expect(formatLastSyncedLabel({ status: 'pending', ts: Date.now() - 5000 }, Date.now())).toContain('pending');
  });
});

describe('i18n key parity', () => {
  function flatKeys(obj, prefix = '') {
    return Object.entries(obj).flatMap(([k, v]) => {
      const full = prefix ? `${prefix}.${k}` : k;
      return v && typeof v === 'object' && !Array.isArray(v) ? flatKeys(v, full) : [full];
    });
  }

  it('EN and DE have identical key sets', () => {
    const enKeys = flatKeys(APP_I18N.en).sort();
    const deKeys = flatKeys(APP_I18N.de).sort();
    expect(deKeys).toEqual(enKeys);
  });

  it('all supported locales are present', () => {
    expect(Object.keys(APP_I18N)).toContain('en');
    expect(Object.keys(APP_I18N)).toContain('de');
  });
});

describe('calculateBMR (Mifflin-St Jeor)', () => {
  it('returns correct BMR for a 75 kg / 175 cm / 25 y.o. male', () => {
    // 10*75 + 6.25*175 - 5*25 + 5 = 750 + 1093.75 - 125 + 5 = 1723.75 → 1724
    expect(calculateBMR({ weight: 75, height: 175, age: 25, sex: 'male' })).toBe(1724);
  });

  it('returns correct BMR for a 60 kg / 165 cm / 30 y.o. female', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25 → 1320
    expect(calculateBMR({ weight: 60, height: 165, age: 30, sex: 'female' })).toBe(1320);
  });

  it('increases with weight', () => {
    const light = calculateBMR({ weight: 60, height: 175, age: 25, sex: 'male' });
    const heavy = calculateBMR({ weight: 100, height: 175, age: 25, sex: 'male' });
    expect(heavy).toBeGreaterThan(light);
  });
});

describe('shouldAutoDeload', () => {
  it('returns null when no stress signals present', () => {
    const checkins = [{ lifts: 'pbs', energy: 8, stress: 3 }];
    expect(shouldAutoDeload({ recentCheckins: checkins })).toBeNull();
  });

  it('triggers deload on two regressions with low energy', () => {
    const checkins = [
      { lifts: 'regressed', energy: 3, stress: 5 },
      { lifts: 'regressed', energy: 4, stress: 5 },
    ];
    const result = shouldAutoDeload({ recentCheckins: checkins });
    expect(result).toBeTruthy();
    expect(result).toContain('two regressed');
  });

  it('triggers deload on two regressions with high stress', () => {
    const checkins = [
      { lifts: 'regressed', energy: 7, stress: 9 },
      { lifts: 'regressed', energy: 7, stress: 8 },
    ];
    const result = shouldAutoDeload({ recentCheckins: checkins });
    expect(result).toBeTruthy();
    expect(result).toContain('high stress');
  });

  it('triggers deload when 8+ stalled exercises with low energy', () => {
    // 3 sessions × 4 exercises: processing in reverse gives 8 stalls (sessions 2 + 1 both stall)
    const makeSession = (weight) => ({ exercises: Array.from({ length: 4 }, (_, i) => ({ name: `ex${i}`, maxWeight: weight })) });
    const sessions = [makeSession(100), makeSession(100), makeSession(100)];
    const checkins = [{ lifts: 'same', energy: 4, stress: 5 }];
    const result = shouldAutoDeload({ recentCheckins: checkins, recentSessions: sessions });
    expect(result).toBeTruthy();
    expect(result).toContain('stalled');
  });

  it('returns null if stalled sessions but energy is fine', () => {
    const session1 = { exercises: Array.from({ length: 4 }, (_, i) => ({ name: `ex${i}`, maxWeight: 100 })) };
    const session2 = { exercises: Array.from({ length: 4 }, (_, i) => ({ name: `ex${i}`, maxWeight: 100 })) };
    const checkins = [{ lifts: 'same', energy: 7, stress: 3 }];
    expect(shouldAutoDeload({ recentCheckins: checkins, recentSessions: [session1, session2] })).toBeNull();
  });
});

describe('mlFeatureVecV2', () => {
  const baseCheckin = {
    energy: 8,
    stress: 3,
    sleep: '7-8hrs',
    lifts: 'pbs',
    diet: 'on_target',
    weight: 80,
    isoDate: '2025-01-06', // Monday
  };

  it('returns a 10-element vector', () => {
    expect(mlFeatureVecV2(baseCheckin)).toHaveLength(10);
  });

  it('first element is bias term 1', () => {
    expect(mlFeatureVecV2(baseCheckin)[0]).toBe(1);
  });

  it('all values are between 0 and 1 (bias excluded)', () => {
    const vec = mlFeatureVecV2(baseCheckin);
    vec.slice(1).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  it('monday (index 7) normalises to 0', () => {
    // Monday = dow 0, normalised = 0/6 = 0
    const vec = mlFeatureVecV2({ ...baseCheckin, isoDate: '2025-01-06' }); // Mon
    expect(vec[7]).toBeCloseTo(0);
  });

  it('rolling averages differ from single-checkin defaults when priors provided', () => {
    const priors = [
      { energy: 3, stress: 9 },
      { energy: 4, stress: 8 },
    ];
    const withPriors = mlFeatureVecV2(baseCheckin, priors);
    const withoutPriors = mlFeatureVecV2(baseCheckin);
    // With low-energy priors, rolling energy (index 8) should be lower
    expect(withPriors[8]).toBeLessThan(withoutPriors[8]);
  });
});

import { getMuscleRecoveryMap, getMuscleVolumeModifier, getAdaptiveScheme } from '../src/modules/fitness.js';

describe('getMuscleRecoveryMap', () => {
  const TODAY = '2025-06-15';

  function makeSession(isoDate, exercises) {
    return { isoDate, exercises };
  }

  it('returns full recovery for a muscle never trained', () => {
    const map = getMuscleRecoveryMap([], [], TODAY);
    expect(map.chest).toBeGreaterThanOrEqual(1.0);
  });

  it('returns low recovery score immediately after a session', () => {
    const sessions = [makeSession(TODAY, [{ name: 'bench', muscle: 'chest', maxWeight: 100 }])];
    const map = getMuscleRecoveryMap([], sessions, TODAY);
    expect(map.chest).toBeLessThan(0.5);
  });

  it('returns higher recovery score after 3 days have passed', () => {
    const sessions = [makeSession('2025-06-12', [{ name: 'bench', muscle: 'chest', maxWeight: 100 }])];
    const map = getMuscleRecoveryMap([], sessions, TODAY);
    expect(map.chest).toBeCloseTo(1.0, 1);
  });

  it('reduces recovery when soreness is reported after last session', () => {
    const sessions = [makeSession('2025-06-13', [{ name: 'bench', muscle: 'chest', maxWeight: 100 }])];
    const checkins = [{ isoDate: '2025-06-14', sorenessAreas: ['chest'] }];
    const map = getMuscleRecoveryMap(checkins, sessions, TODAY);
    const noSorenessMap = getMuscleRecoveryMap([], sessions, TODAY);
    expect(map.chest).toBeLessThan(noSorenessMap.chest);
  });

  it('gives a small bonus for 3-session progressive overload', () => {
    const sessions = [
      // Last session 3 days ago → base recovery = 1.0, then bonus applies
      makeSession('2025-06-12', [{ name: 'bench', muscle: 'chest', maxWeight: 110 }]),
      makeSession('2025-06-09', [{ name: 'bench', muscle: 'chest', maxWeight: 105 }]),
      makeSession('2025-06-06', [{ name: 'bench', muscle: 'chest', maxWeight: 100 }]),
    ];
    const map = getMuscleRecoveryMap([], sessions, TODAY);
    expect(map.chest).toBeGreaterThan(1.0);
  });

  it('all values are clamped between 0 and 1.1', () => {
    const sessions = [makeSession(TODAY, [{ name: 'bench', muscle: 'chest', maxWeight: 100 }])];
    const map = getMuscleRecoveryMap([], sessions, TODAY);
    Object.values(map).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1.1);
    });
  });
});

describe('getMuscleVolumeModifier', () => {
  it('returns 0.6 when muscle is sore regardless of recovery', () => {
    expect(getMuscleVolumeModifier('chest', { chest: 0.9 }, ['chest'])).toBe(0.6);
  });

  it('returns 0.6 when recovery is below 0.4', () => {
    expect(getMuscleVolumeModifier('back', { back: 0.3 }, [])).toBe(0.6);
  });

  it('returns 0.85 when recovery is between 0.4 and 0.7', () => {
    expect(getMuscleVolumeModifier('quads', { quads: 0.55 }, [])).toBe(0.85);
  });

  it('returns 1.0 for full recovery with no soreness', () => {
    expect(getMuscleVolumeModifier('hamstrings', { hamstrings: 0.8 }, [])).toBe(1.0);
  });

  it('returns 1.1 for overload-bonus recovery score above 1.0', () => {
    expect(getMuscleVolumeModifier('shoulders', { shoulders: 1.05 }, [])).toBe(1.1);
  });

  it('defaults to 1.0 when muscle not in recovery map', () => {
    expect(getMuscleVolumeModifier('biceps', {}, [])).toBe(1.0);
  });
});

describe('getAdaptiveScheme', () => {
  const makeSession = (isoDate, exName, maxReps) => ({
    isoDate,
    exercises: [{ name: exName, muscle: 'chest', maxReps, maxWeight: 100 }],
  });

  it('returns base scheme unchanged when no history', () => {
    expect(getAdaptiveScheme('3×8–12', 'bench', [], [], 'chest')).toBe('3×8–12');
  });

  it('pushes rep range up when hitting top consistently', () => {
    const sessions = [
      makeSession('2025-06-14', 'bench', 12),
      makeSession('2025-06-11', 'bench', 12),
    ];
    const result = getAdaptiveScheme('3×8–12', 'bench', sessions, [], 'chest');
    expect(result).not.toBe('3×8–12');
    expect(result).toContain('9–14');
  });

  it('reduces sets when consistently missing target reps', () => {
    const sessions = [
      makeSession('2025-06-14', 'bench', 4),
      makeSession('2025-06-11', 'bench', 3),
    ];
    const result = getAdaptiveScheme('3×8–12', 'bench', sessions, [], 'chest');
    expect(result.startsWith('2×')).toBe(true);
  });

  it('reduces sets when muscle is sore even without history', () => {
    const result = getAdaptiveScheme('3×8–12', 'bench', [], ['chest'], 'chest');
    expect(result.startsWith('2×')).toBe(true);
  });

  it('does not reduce below 2 sets', () => {
    const result = getAdaptiveScheme('2×8–12', 'bench', [], ['chest'], 'chest');
    expect(result.startsWith('2×')).toBe(true);
  });

  it('leaves time-based schemes (e.g. plank) unchanged', () => {
    expect(getAdaptiveScheme('3×30–45s', 'plank', [], ['core'], 'core')).toBe('3×30–45s');
  });

  it('returns base scheme when null inputs are provided', () => {
    expect(getAdaptiveScheme(null, 'bench', [], [], 'chest')).toBeNull();
    expect(getAdaptiveScheme('3×8–12', null, [], [], 'chest')).toBe('3×8–12');
  });
});

import { deriveSessionTag } from '../src/modules/fitness.js';

describe('deriveSessionTag', () => {
  it('returns "upper" for chest/back/shoulders session', () => {
    expect(deriveSessionTag(['chest', 'shoulders', 'triceps'])).toBe('upper');
  });

  it('returns "lower" for quads/hamstrings/glutes session', () => {
    expect(deriveSessionTag(['quads', 'hamstrings', 'glutes'])).toBe('lower');
  });

  it('returns "full" when both upper and lower muscles are present', () => {
    expect(deriveSessionTag(['back', 'quads', 'hamstrings'])).toBe('full');
  });

  it('returns "focus" for accessory-only muscles (calves, core)', () => {
    expect(deriveSessionTag(['calves', 'core'])).toBe('focus');
  });

  it('returns "focus" for an empty muscle list', () => {
    expect(deriveSessionTag([])).toBe('focus');
  });

  it('returns "lower" even when calves are included', () => {
    expect(deriveSessionTag(['quads', 'hamstrings', 'calves'])).toBe('lower');
  });
});



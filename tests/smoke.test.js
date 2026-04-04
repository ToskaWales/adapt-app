import { describe, expect, it } from 'vitest';

import { getGoogleLoginErrorMessage, shouldPreferGoogleRedirect } from '../src/modules/auth.js';
import { getGoalAdherenceInsights, getWeeklyProgressSummary } from '../src/modules/insights.js';
import { buildFirstRunChecklist, buildFirstRunEmptyState } from '../src/modules/onboarding.js';
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
  });
});

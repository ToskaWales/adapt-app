function toMs(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'number') return value;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatWeightDelta(delta) {
  if (!delta) return 'stable bodyweight';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)} kg bodyweight change`;
}

export function getWeeklyProgressSummary({
  checkins = [],
  sessions = [],
  activities = [],
  now = Date.now(),
} = {}) {
  const cutoff = now - 7 * 24 * 60 * 60 * 1000;
  const recentCheckins = checkins.filter((entry) => toMs(entry.createdAt || entry.isoDate || entry.date) >= cutoff);
  const recentSessions = sessions.filter(
    (entry) => toMs(entry.createdAt || entry.isoDate || entry.date) >= cutoff && entry.dayName !== 'Custom EMOM'
  );
  const recentActivities = activities.filter((entry) => toMs(entry.createdAt || entry.isoDate || entry.date) >= cutoff);
  const cardioMinutes = recentActivities.reduce((sum, entry) => sum + (parseFloat(entry.duration) || 0), 0);
  const weightSeries = recentCheckins
    .filter((entry) => entry.weight)
    .map((entry) => parseFloat(entry.weight))
    .filter((value) => Number.isFinite(value));
  const weightDelta = weightSeries.length >= 2 ? weightSeries[0] - weightSeries[weightSeries.length - 1] : 0;
  const score = Math.max(
    5,
    Math.min(
      100,
      Math.round(
        recentSessions.length * 24 + recentCheckins.length * 22 + Math.min(cardioMinutes, 150) * 0.18 + (weightSeries.length ? 12 : 0)
      )
    )
  );

  const summaryParts = [
    `${recentSessions.length} gym session${recentSessions.length === 1 ? '' : 's'}`,
    `${recentCheckins.length} check-in${recentCheckins.length === 1 ? '' : 's'}`,
    `${Math.round(cardioMinutes)} cardio min`,
    formatWeightDelta(weightDelta),
  ];

  return {
    score,
    summary: summaryParts.join(' · '),
    gymSessions: recentSessions.length,
    checkins: recentCheckins.length,
    cardioMinutes: Math.round(cardioMinutes),
    weightDelta: Number(weightDelta.toFixed(1)),
  };
}

export function getGoalAdherenceInsights(checkins = [], profile = {}, now = Date.now()) {
  const recent = checkins.slice(0, 6);
  if (!recent.length) {
    return {
      score: 0,
      level: 'Starting up',
      copy: 'Log your first few check-ins so ADDAPT can score adherence and spot your trend.',
      signals: ['No trend data yet', goalLabel(profile?.dietGoal || 'maintain')],
    };
  }

  const avgEnergy = recent.reduce((sum, entry) => sum + (parseFloat(entry.energy) || 0), 0) / recent.length;
  const onTargetCount = recent.filter((entry) => entry.diet === 'on_target').length;
  const positiveLiftCount = recent.filter((entry) => entry.lifts === 'pbs' || entry.lifts === 'slightly_up').length;
  const daysSinceLast = Math.max(0, Math.round((now - toMs(recent[0].createdAt || recent[0].isoDate || recent[0].date)) / 86400000));

  const score = Math.max(
    15,
    Math.min(
      100,
      Math.round(
        (avgEnergy / 10) * 35 +
          (onTargetCount / recent.length) * 30 +
          (positiveLiftCount / recent.length) * 25 +
          (daysSinceLast <= 7 ? 10 : 0)
      )
    )
  );

  const level = score >= 80 ? 'Locked in' : score >= 60 ? 'On track' : 'Needs attention';
  const copy =
    score >= 80
      ? 'Recent check-ins show strong consistency on energy, food, and gym performance. Keep the same rhythm.'
      : score >= 60
        ? 'Your trend is mostly solid, but tightening nutrition or recovery would improve adaptation speed.'
        : 'Check-in trends show recovery or food consistency is slipping. Simplify the week and focus on the basics.';

  return {
    score,
    level,
    copy,
    signals: [
      `Energy ${avgEnergy.toFixed(1)}/10`,
      `${onTargetCount}/${recent.length} on-target diet logs`,
      `${positiveLiftCount}/${recent.length} positive lift trend`,
    ],
  };
}

function goalLabel(goal) {
  return {
    bulk: 'Bulk focus',
    maintain: 'Maintain focus',
    cut: 'Cut focus',
  }[goal] || 'Maintain focus';
}

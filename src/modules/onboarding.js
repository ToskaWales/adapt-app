function cap(value = '') {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function goalLabel(goal) {
  return {
    vtaper: 'V-Taper / Athletic',
    hourglass: 'Hourglass / Curves',
    strength: 'Strength and Power',
    general: 'General Fitness',
  }[goal] || 'General Fitness';
}

const RECOMMENDED_TRAINING_DAYS = {
  1: ['Mon'],
  2: ['Mon', 'Thu'],
  3: ['Mon', 'Wed', 'Fri'],
  4: ['Mon', 'Tue', 'Thu', 'Sat'],
  5: ['Mon', 'Tue', 'Thu', 'Fri', 'Sun'],
  6: ['Mon', 'Tue', 'Wed', 'Fri', 'Sat', 'Sun'],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getRecommendedFocusMuscles({ goal = 'general', sex = 'male' } = {}) {
  if (goal === 'general' && sex === 'female') {
    return ['glutes', 'back'];
  }

  return {
    vtaper: ['back', 'shoulders'],
    hourglass: ['glutes', 'shoulders'],
    strength: ['quads', 'back'],
    general: ['back', 'core'],
  }[goal] || ['back', 'core'];
}

export function getRecommendedTrainingSetup({
  goal = 'general',
  experience = 'beginner',
  consistency = 'building',
  days,
  workStyle = 'mixed',
  activityLevel = 'moderate',
  sex = 'male',
  focusMuscles = [],
} = {}) {
  const baseDaysByGoal = { vtaper: 4, hourglass: 4, strength: 4, general: 3 };
  let recommendedDays = Number.isFinite(Number(days))
    ? clamp(parseInt(days, 10), 1, 7)
    : baseDaysByGoal[goal] || 3;

  if (!Number.isFinite(Number(days))) {
    if (experience === 'advanced') recommendedDays += 1;
    if (consistency === 'off_track') recommendedDays -= 1;
    if (consistency === 'locked_in') recommendedDays += 1;
    if (workStyle === 'physical') recommendedDays -= 1;
    if (activityLevel === 'athlete') recommendedDays += 1;
    recommendedDays = clamp(recommendedDays, 2, 6);
  }

  let sessionLen = 45;
  if (goal === 'strength' && experience !== 'beginner') sessionLen = 60;
  if (recommendedDays <= 2) sessionLen = Math.max(sessionLen, 45);
  if (consistency === 'off_track' || workStyle === 'physical') sessionLen = Math.min(sessionLen, 45);
  if (activityLevel === 'athlete' && consistency === 'locked_in') sessionLen = Math.max(sessionLen, 60);

  let splitPreset = 'adaptive';
  if (recommendedDays <= 2) splitPreset = 'fullbody';
  else if (goal === 'strength') splitPreset = recommendedDays >= 4 ? 'upperlower' : 'fullbody';
  else if (recommendedDays === 3 && goal === 'general') splitPreset = 'pushpulllegs';
  else if (recommendedDays === 3 && goal === 'hourglass') splitPreset = 'fullbody';
  else if (recommendedDays >= 5 && goal === 'vtaper') splitPreset = 'adaptive';

  let trainingDays = RECOMMENDED_TRAINING_DAYS[Math.min(recommendedDays, 6)] || RECOMMENDED_TRAINING_DAYS[4];
  if (workStyle === 'physical' && recommendedDays === 4) {
    trainingDays = ['Mon', 'Wed', 'Fri', 'Sun'];
  }

  const suggestedFocus = focusMuscles.length ? focusMuscles.slice(0, 2) : getRecommendedFocusMuscles({ goal, sex });

  return {
    days: recommendedDays,
    sessionLen,
    splitPreset,
    trainingDays,
    focusMuscles: suggestedFocus,
    dayReason:
      recommendedDays >= 4
        ? 'Enough frequency to progress without relying on marathon sessions.'
        : 'A realistic weekly target that stays easier to recover from and stick to.',
    splitReason:
      splitPreset === 'upperlower'
        ? 'Best balance of strength work and recovery for your profile.'
        : splitPreset === 'pushpulllegs'
          ? 'Clean muscle-group separation that fits your current frequency.'
          : splitPreset === 'fullbody'
            ? 'Higher full-body frequency gives you the most return on fewer training days.'
            : 'Adaptive keeps the split flexible as your check-ins change.',
    focusReason: `${suggestedFocus.map((muscle) => cap(muscle)).join(' + ')} best support ${goalLabel(goal)} right now.`,
    equipmentHint:
      goal === 'strength'
        ? 'A full gym unlocks the strongest lift progression, but the plan can still scale down if needed.'
        : 'Choose the setup you can use consistently — consistency beats theoretical perfect equipment.',
  };
}

export function buildFirstRunChecklist({
  trainingDays = [],
  sessionLen = 60,
  saunaGoal = 'recovery',
  saunaDays = [],
  reminderSummary = 'Check-In',
} = {}) {
  return [
    `Run your first check-in to activate recovery and calorie adjustments.`,
    `Train on ${trainingDays.join(' · ') || 'your selected days'} for about ${sessionLen} minutes.`,
    `Use ${cap(saunaGoal)} mode on ${saunaDays.join(' · ') || 'your recovery days'}.`,
    `Reminders ready: ${reminderSummary}.`,
  ];
}

export function buildFirstRunEmptyState({
  goal = 'general',
  trainingDays = [],
  sessionLen = 60,
  focusMuscles = [],
  saunaGoal = 'recovery',
  saunaDays = [],
  reminderSummary = 'Check-In',
} = {}) {
  const checklist = buildFirstRunChecklist({
    trainingDays,
    sessionLen,
    saunaGoal,
    saunaDays,
    reminderSummary,
  });

  const focusCopy = focusMuscles.length
    ? focusMuscles.map((muscle) => cap(muscle)).join(' · ')
    : 'General balance';

  return `
    <div class="section-kicker">Welcome</div>
    <div class="section-title">First Week Game Plan</div>
    <div class="section-copy">Your dashboard is ready for ${goalLabel(goal)}. Once you log a check-in and a session, ADDAPT starts adapting around your real trend data.</div>
    <div class="empty-state-card">
      <div class="empty-state-top">
        <strong>Focus</strong>
        <span>${focusCopy}</span>
      </div>
      <ul class="empty-state-list">
        ${checklist.map((item) => `<li>${item}</li>`).join('')}
      </ul>
      <div class="pwa-note">Tip: install ADDAPT to your home screen for quicker launches and offline access.</div>
    </div>
  `;
}

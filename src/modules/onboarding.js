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

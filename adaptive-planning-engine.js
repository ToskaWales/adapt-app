/**
 * ADAPT Adaptive Workout Planning Engine v2.0
 * Intelligent goal-based training plan generation
 * 
 * Supports:
 * - 8 goals (muscle_gain, strength, fat_loss, endurance, athletic_performance, general_fitness, vtaper, hourglass)
 * - 7 training frequencies (1-7 days/week)
 * - Science-backed set budgeting
 * - Goal-specific muscle prioritization
 * - Periodized training blocks
 */

window.AdaptivePlanningEngine = {
  
  // ──────────────────────────────────────────
  // CONFIGURATION
  // ──────────────────────────────────────────

  // Goal-specific weekly set budgets (adjusted by recovery tier)
  SET_BUDGETS: {
    muscle_gain: 60,
    strength: 40,
    fat_loss: 40,
    endurance: 30,
    athletic_performance: 45,
    general_fitness: 45,
    vtaper: 55,
    hourglass: 55
  },

  // Recovery tier multipliers
  VOLUME_ADJUSTMENTS: {
    0: 0.6,  // Deload - 60% volume
    1: 0.85, // Moderate - 85% volume
    2: 1.0   // Strong - 100% volume
  },

  // Rep ranges per goal and experience level
  REP_RANGES: {
    muscle_gain: {
      beginner: '8–12',
      intermediate: '6–12',
      advanced: '5–10'
    },
    strength: {
      beginner: '6–8',
      intermediate: '3–6',
      advanced: '1–5'
    },
    fat_loss: {
      beginner: '10–15',
      intermediate: '8–12',
      advanced: '6–10'
    },
    endurance: {
      beginner: '15–20',
      intermediate: '12–18',
      advanced: '10–15'
    },
    athletic_performance: {
      beginner: '6–10',
      intermediate: '5–8',
      advanced: '3–6'
    },
    general_fitness: {
      beginner: '8–12',
      intermediate: '8–10',
      advanced: '6–8'
    },
    vtaper: {
      beginner: '6–10',
      intermediate: '5–8',
      advanced: '3–6'
    },
    hourglass: {
      beginner: '8–12',
      intermediate: '6–10',
      advanced: '5–8'
    }
  },

  // ──────────────────────────────────────────
  // MUSCLE GROUP ALLOCATION
  // ──────────────────────────────────────────
  
  /**
   * Get goal-specific muscle allocation
   * Returns number of sets per muscle group
   */
  getMuscleAllocation(goal, focusMuscles = []) {
    const allocations = {
      muscle_gain: { chest: 8, back: 8, shoulders: 6, arms: 6, legs: 10, core: 2 },
      strength: { chest: 7, back: 8, shoulders: 5, arms: 3, legs: 12, core: 1 },
      fat_loss: { chest: 6, back: 7, shoulders: 5, arms: 4, legs: 9, core: 3 },
      endurance: { chest: 4, back: 5, shoulders: 4, arms: 2, legs: 12, core: 1 },
      athletic_performance: { chest: 6, back: 7, shoulders: 7, arms: 3, legs: 10, core: 2 },
      general_fitness: { chest: 5, back: 5, shoulders: 5, arms: 4, legs: 8, core: 3 },
      vtaper: { chest: 6, back: 10, shoulders: 12, arms: 5, legs: 6, core: 2 },
      hourglass: { chest: 4, back: 5, shoulders: 8, arms: 3, legs: 5, glutes: 14, core: 3 }
    };
    return allocations[goal] || allocations.general_fitness;
  },

  /**
   * Get rep range for a given goal and experience level
   */
  getRepRange(goal, experience, isIsolation = false) {
    if (isIsolation) {
      // Isolation exercises: 1-2 reps higher than compounds
      const range = this.REP_RANGES[goal]?.[experience] || '8–12';
      const match = range.match(/(\d+)–(\d+)/);
      if (match) {
        const low = parseInt(match[1]) + 1;
        const high = parseInt(match[2]) + 2;
        return `${low}–${high}`;
      }
      return '10–15';
    }
    return this.REP_RANGES[goal]?.[experience] || '8–12';
  },

  // ──────────────────────────────────────────
  // SET BUDGET CALCULATION
  // ──────────────────────────────────────────

  /**
   * Calculate weekly set budget based on goal and recovery
   */
  calculateWeeklyBudget(goal, recoveryTier = 2) {
    const baseBudget = this.SET_BUDGETS[goal] || 45;
    const volumeMultiplier = this.VOLUME_ADJUSTMENTS[recoveryTier] || 1.0;
    return Math.round(baseBudget * volumeMultiplier);
  },

  /**
   * Calculate sets per session for a given frequency
   */
  calculateSetsPerSession(weeklyBudget, trainingFrequency) {
    if (trainingFrequency < 1 || trainingFrequency > 7) return Math.ceil(weeklyBudget / 4);
    return Math.ceil(weeklyBudget / trainingFrequency);
  },

  // ──────────────────────────────────────────
  // SPLIT RECOMMENDATIONS
  // ──────────────────────────────────────────

  /**
   * Get recommended split type for frequency
   */
  getRecommendedSplit(frequency, goal) {
    const splits = {
      1: { name: 'Full Body Minimal', description: 'Single complete session', days: ['Mon'] },
      2: { name: 'Full Body A/B', description: 'Two balanced sessions', days: ['Mon', 'Thu'] },
      3: { name: 'Push/Pull/Legs', description: 'Three specialized days', days: ['Mon', 'Wed', 'Fri'] },
      4: { 
        name: goal === 'hourglass' ? 'Upper/Lower (Glute Focus)' : 'Upper/Lower',
        description: 'Four balanced sessions', 
        days: ['Mon', 'Tue', 'Thu', 'Fri'] 
      },
      5: { 
        name: goal === 'hourglass' ? 'PPL + Focus' : 'Upper/Lower + Focus',
        description: 'Five specialized sessions', 
        days: ['Mon', 'Tue', 'Thu', 'Fri', 'Sat'] 
      },
      6: { 
        name: goal === 'hourglass' ? 'Lower x4 / Upper x2' : 'Push/Pull/Legs ×2',
        description: 'Six high-frequency sessions', 
        days: ['Mon', 'Tue', 'Wed', 'Fri', 'Sat', 'Sun'] 
      },
      7: { 
        name: 'Full Splits Daily',
        description: 'Elite athlete frequency', 
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] 
      }
    };
    return splits[frequency] || splits[4];
  },

  // ──────────────────────────────────────────
  // EXERCISE SELECTION
  // ──────────────────────────────────────────

  /**
   * Get goal-specific exercise list
   * Returns exercises organized by category
   */
  getExercisesForGoal(goal, equipment = 'full', focusMuscles = [], tier = 2) {
    const isFullGym = equipment === 'full';
    const isDumbbells = equipment === 'dumbbells';
    const isBands = equipment === 'bands';
    const isBodyweight = equipment === 'none';

    const exercises = {
      // Push exercises
      push_chest: isFullGym
        ? [
            ['Barbell Bench Press', 'compound'],
            ['Incline Barbell Press', 'compound'],
            ['Cable Chest Fly', 'isolation'],
            ['Chest Dip', 'compound'],
            ['Machine Chest Press', 'compound']
          ]
        : isDumbbells
        ? [
            ['DB Bench Press', 'compound'],
            ['Incline DB Press', 'compound'],
            ['DB Chest Fly', 'isolation'],
            ['Dumbbell Pullovers', 'compound']
          ]
        : isBands
        ? [
            ['Band Push-Up', 'compound'],
            ['Band Chest Press', 'isolation'],
            ['Band Fly', 'isolation']
          ]
        : [
            ['Push-Ups', 'compound'],
            ['Wide Push-Ups', 'isolation'],
            ['Diamond Push-Ups', 'compound']
          ],

      push_shoulders: isFullGym
        ? [
            ['Barbell Overhead Press', 'compound'],
            ['Lateral Raise', 'isolation'],
            ['Cable Lateral Raise', 'isolation'],
            ['Face Pull', 'isolation'],
            ['Barbell Upright Row', 'compound']
          ]
        : isDumbbells
        ? [
            ['DB Shoulder Press', 'compound'],
            ['DB Lateral Raise', 'isolation'],
            ['DB Front Raise', 'isolation'],
            ['Arnold Press', 'compound']
          ]
        : isBands
        ? [
            ['Band Overhead Press', 'compound'],
            ['Band Lateral Raise', 'isolation'],
            ['Band Face Pull', 'isolation']
          ]
        : [
            ['Pike Push-Up', 'compound'],
            ['Shoulder Tap', 'isolation'],
            ['Handstand Hold', 'compound']
          ],

      push_triceps: isFullGym
        ? [
            ['Rope Pushdown', 'isolation'],
            ['Skull Crushers', 'isolation'],
            ['Tricep Dip', 'compound'],
            ['Close-Grip Bench', 'compound']
          ]
        : isDumbbells
        ? [
            ['DB Tricep Kickback', 'isolation'],
            ['DB Overhead Extension', 'isolation'],
            ['Tricep Dip', 'compound']
          ]
        : isBands
        ? [
            ['Band Tricep Pushdown', 'isolation'],
            ['Band Tricep Extension', 'isolation']
          ]
        : [
            ['Diamond Push-Up', 'compound'],
            ['Tricep Dip', 'compound']
          ],

      // Pull exercises
      pull_back: isFullGym
        ? [
            ['Weighted Pull-Up', 'compound'],
            ['Barbell Row', 'compound'],
            ['Bent-Over Barbell Row', 'compound'],
            ['Seated Cable Row', 'compound'],
            ['Lat Pulldown', 'compound'],
            ['Straight-Arm Pulldown', 'isolation']
          ]
        : isDumbbells
        ? [
            ['DB Row', 'compound'],
            ['Pull-Up', 'compound'],
            ['Renegade Row', 'compound'],
            ['DB Pullover', 'compound']
          ]
        : isBands
        ? [
            ['Band Pull-Apart', 'isolation'],
            ['Band Row', 'compound'],
            ['Pull-Up', 'compound']
          ]
        : [
            ['Pull-Up', 'compound'],
            ['Inverted Row', 'compound'],
            ['Reverse Snow Angel', 'isolation']
          ],

      pull_biceps: isFullGym
        ? [
            ['EZ-Bar Curl', 'isolation'],
            ['Hammer Curl', 'isolation'],
            ['Cable Curl', 'isolation'],
            ['Barbell Curl', 'compound']
          ]
        : isDumbbells
        ? [
            ['DB Curl', 'isolation'],
            ['Hammer Curl', 'isolation'],
            ['Concentration Curl', 'isolation']
          ]
        : isBands
        ? [
            ['Band Curl', 'isolation'],
            ['Chin-Up', 'compound']
          ]
        : [
            ['Chin-Up', 'compound'],
            ['Resistance Band Curl', 'isolation']
          ],

      // Leg exercises
      legs_quads: isFullGym
        ? [
            ['Barbell Squat', 'compound'],
            ['Front Squat', 'compound'],
            ['Leg Press', 'compound'],
            ['Walking Lunge', 'compound'],
            ['Leg Extension', 'isolation']
          ]
        : isDumbbells
        ? [
            ['Goblet Squat', 'compound'],
            ['DB Lunge', 'compound'],
            ['DB Step-Up', 'compound'],
            ['Split Squat', 'compound']
          ]
        : isBands
        ? [
            ['Band Squat', 'compound'],
            ['Lateral Band Walk', 'isolation'],
            ['Leg Extension Band', 'isolation']
          ]
        : [
            ['Bodyweight Squat', 'compound'],
            ['Jump Squat', 'compound'],
            ['Bulgarian Split Squat', 'compound']
          ],

      legs_hamstrings: isFullGym
        ? [
            ['Romanian Deadlift', 'compound'],
            ['Leg Curl', 'isolation'],
            ['Good Morning', 'compound'],
            ['Lying Leg Curl', 'isolation']
          ]
        : isDumbbells
        ? [
            ['DB Romanian Deadlift', 'compound'],
            ['Nordic Curl', 'compound']
          ]
        : isBands
        ? [
            ['Band Good Morning', 'compound'],
            ['Nordic Curl', 'compound']
          ]
        : [
            ['Nordic Curl', 'compound'],
            ['Glute Bridge', 'compound']
          ],

      legs_glutes: isFullGym
        ? [
            ['Hip Thrust (Barbell)', 'compound'],
            ['Cable Kickback', 'isolation'],
            ['Bulgarian Split Squat', 'compound'],
            ['Sumo Deadlift', 'compound'],
            ['Abductor Machine', 'isolation']
          ]
        : isDumbbells
        ? [
            ['DB Hip Thrust', 'compound'],
            ['Bulgarian Split Squat', 'compound'],
            ['DB Sumo Squat', 'compound'],
            ['Glute Bridge', 'compound']
          ]
        : isBands
        ? [
            ['Band Glute Bridge', 'isolation'],
            ['Donkey Kick', 'isolation'],
            ['Band Side Walk', 'isolation']
          ]
        : [
            ['Glute Bridge', 'compound'],
            ['Single-Leg Glute Bridge', 'compound'],
            ['Donkey Kick', 'isolation']
          ],

      core: [
        ['Plank', 'isometric'],
        ['Ab Wheel', 'isolation'],
        ['Hanging Leg Raise', 'isolation'],
        ['Cable Crunch', 'isolation'],
        ['Russian Twist', 'isolation']
      ]
    };

    return exercises;
  },

  // ──────────────────────────────────────────
  // ANALYSIS & PLANNING
  // ──────────────────────────────────────────

  /**
   * Determine recovery tier from check-in data
   */
  calculateRecoveryTier(energy, stress, sleep, isDeload = false) {
    if (isDeload) return 0;
    if (energy <= 3) return 0;
    if (energy <= 5) return ((sleep === '7-8hrs' || sleep === '8+hrs') && stress <= 5) ? 1 : 0;
    if (energy <= 7) return (sleep === '<5hrs' || stress >= 8) ? 1 : 2;
    return ((sleep === '<5hrs' || sleep === '5-6hrs') && stress >= 7) ? 1 : 2;
  },

  /**
   * Generate a training plan summary
   */
  generatePlanSummary(profile, checkin, weekNum = 0) {
    const goal = profile.goal || 'general_fitness';
    const frequency = profile.days || 4;
    const experience = profile.experience || 'intermediate';
    const equipment = profile.equipment || 'full';
    const recovery = this.calculateRecoveryTier(checkin.energy, checkin.stress, checkin.sleep);

    const weeklyBudget = this.calculateWeeklyBudget(goal, recovery);
    const setsPerSession = this.calculateSetsPerSession(weeklyBudget, frequency);
    const split = this.getRecommendedSplit(frequency, goal);
    const repRange = this.getRepRange(goal, experience);
    const muscleAllocation = this.getMuscleAllocation(goal, profile.focusMuscles);

    // Determine training block
    const BLOCK_CYCLE = 8, HYPERTROPHY_WEEKS = 5;
    const positionInCycle = weekNum % BLOCK_CYCLE;
    const isStrengthBlock = positionInCycle >= HYPERTROPHY_WEEKS;
    const blockWeek = isStrengthBlock ? positionInCycle - HYPERTROPHY_WEEKS + 1 : positionInCycle + 1;
    const blockName = isStrengthBlock ? 'Strength' : 'Hypertrophy';

    return {
      goal,
      frequency,
      experience,
      equipment,
      recovery: ['Deload', 'Moderate', 'Strong'][recovery],
      weeklyBudget,
      setsPerSession,
      split,
      repRange,
      muscleAllocation,
      blockName,
      blockWeek,
      isStrengthBlock
    };
  }
};

// Export for use in browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.AdaptivePlanningEngine;
}

/**
 * ADDAPT internationalisation strings.
 * Exported here so they can be imported by both app.js and test files.
 */
export const APP_I18N = {
  en: {
    intro: {
      hero: {
        kicker: 'Why ADDAPT Hits Different',
        title: 'One app for your plan, progress, food and recovery',
        copy: 'Instead of giving you one fixed routine, ADDAPT keeps updating your training and diet from your real check-ins, saved lifts, bodyweight trend and recovery score.',
        pill1: 'Addaptive training split',
        pill2: 'Auto calorie shifts',
        pill3: 'Weight analytics',
        pill4: 'Goal-based sauna guide',
      },
      tour: {
        kicker: 'How To Use ADDAPT',
        title: 'Check in, train, log, improve',
        copy: 'The app works best when you run the loop: update your status, follow the plan, log your lifts, then let ADDAPT adjust the next block around what actually happened.',
        f1: {
          title: 'Check-In drives the plan',
          copy: 'Energy, sleep, diet, lifts and bodyweight feed the adaptive engine so calories and training mode stay aligned with your real week.',
        },
        f2: {
          title: 'Training and analytics stay connected',
          copy: 'Current Plan shows the split, Log Session stores performance, and Strength Progress turns that into PR tracking, charts and useful weight history.',
        },
        f3: {
          title: 'Recovery gets its own system',
          copy: 'Sauna Calculator gives a guide for cardio, stress, recovery or longevity with heat protocol, timer, hydration and weekly placement.',
        },
        safari:
          'In Safari: tap Share then Add to Home Screen for the full native app experience.',
        legal:
          'Built for general fitness and recovery planning. If you are dealing with injury, symptoms, or treatment decisions, use a qualified clinician for that part.',
      },
    },
    home: {
      greeting: 'Hey {name}',
      goalSub: '{goal} plan active',
      streak: {
        title: '{count}-week streak',
        done: 'You already locked in this week.',
        pending: 'One check-in this week keeps it alive.',
      },
      checkin: {
        today: 'You checked in today — check in again anytime',
        yesterday: 'Last check-in: yesterday — update your plan?',
        daysAgo: 'Last check-in: {days} days ago — update your plan now',
      },
      card: {
        checkin: {
          title: 'Check-In',
          desc: 'Log energy, lifts and diet — get your updated plan instantly',
        },
        plan: {
          title: 'Current Plan',
          desc: 'View your personalised training and diet',
        },
        log: {
          title: 'Log Session',
          desc: 'Record today\'s lifts and track strength progress',
        },
        emom: {
          title: 'EMOM',
          desc: 'Quick minute-by-minute rounds with auto set tracking',
        },
        strength: {
          title: 'Strength Progress',
          desc: 'Exercise charts, PRs and volume',
        },
        sauna: {
          title: 'Sauna Calculator',
          badge: 'Hot New',
          desc: 'Heat protocol, timer, hydration and weekly planning for recovery work',
        },
        history: {
          title: 'Check-In History',
          desc: 'Weight chart and all past check-ins',
        },
        settings: {
          title: 'Settings and Profile',
          desc: 'Edit goals, calories, focus muscles, session length',
        },
      },
    },
    walkthrough: {
      step: 'Feature {current} of {total}',
      spotlight: 'Now showing',
      skip: 'Skip',
      next: 'Next',
      finish: 'Finish',
      checkin: {
        title: 'Check-In',
        copy: 'Start here most often. This updates your calories, recovery mode, training focus, and the next version of your plan from your real data.',
      },
      plan: {
        title: 'Current Plan',
        copy: 'This is your live split. It shows the exact sessions, set bank logic, frequency, and why the week is structured the way it is.',
      },
      log: {
        title: 'Log Session',
        copy: 'Store your lifts after training so ADDAPT can keep building suggestions from your actual performance, not guesses.',
      },
      strength: {
        title: 'Strength Progress',
        copy: 'Track PRs, exercise load trends, volume, and bodyweight changes so progress is visible and measurable.',
      },
      sauna: {
        title: 'Sauna Calculator',
        copy: 'Use goal-specific sauna guidance for recovery, cardio, stress relief or longevity with protocol, timer, hydration and weekly planning.',
      },
      history: {
        title: 'Check-In History',
        copy: 'Look back at bodyweight, old check-ins and plan changes so you can spot trends across whole blocks, not just single days.',
      },
      settings: {
        title: 'Settings and Profile',
        copy: 'Change goals, session length, focus muscles and other inputs whenever your priorities change.',
      },
    },
    settings: {
      title: 'Profile and Settings',
      redo: 'Redo Onboarding',
      reset: 'Reset My Data',
      signout: 'Sign Out',
      helper: 'Tap Redo Onboarding to update any setting.',
      language: 'Language',
      exportData: 'Export My Data',
      label: {
        goal: 'Goal',
        sex: 'Sex',
        age: 'Age',
        experience: 'Experience',
        days: 'Days/week',
        session: 'Session length',
        focus: 'Focus muscles',
        equipment: 'Equipment',
        diet: 'Diet goal',
        goalWeight: 'Goal weight',
      },
    },
    history: {
      loading: 'Loading...',
      empty: 'No check-ins yet.',
      today: 'Today',
      yesterday: 'Yesterday',
      daysAgo: '{days} days ago',
      energy: 'energy',
    },
    toast: {
      welcome: { title: 'Welcome to ADDAPT', body: 'Your personalised plan is ready.' },
      resetFail: {
        title: 'Reset failed',
        body: 'Your data could not be cleared right now.',
      },
      resetDone: {
        title: 'Data reset',
        body: 'Your account is ready for a fresh start.',
      },
      offlineSaved: {
        title: 'Saved offline',
        body: 'Your changes are stored locally and will sync when you reconnect.',
      },
      queueDrained: {
        title: 'Synced',
        body: 'Your offline changes have been saved to the cloud.',
      },
    },
    confirm: {
      reset: 'Delete your profile, check-ins, and logged sessions and start over?',
    },
    level: { rookie: 'Rookie', consistent: 'Consistent', dedicated: 'Dedicated', elite: 'Elite' },
    enum: {
      goal: {
        vtaper: 'V-Taper',
        hourglass: 'Hourglass',
        strength: 'Strength',
        general: 'General Fitness',
      },
      experience: {
        beginner: 'Beginner',
        intermediate: 'Intermediate',
        advanced: 'Advanced',
      },
      sex: { male: 'Male', female: 'Female', other: 'Other' },
      equipment: {
        full: 'Full Gym',
        dumbbells: 'Dumbbells Only',
        bands: 'Resistance Bands',
        none: 'Bodyweight Only',
      },
      dietGoal: { bulk: 'Bulk', maintain: 'Maintain', cut: 'Cut' },
      muscle: {
        chest: 'Chest',
        back: 'Back',
        shoulders: 'Shoulders',
        biceps: 'Biceps',
        triceps: 'Triceps',
        glutes: 'Glutes',
        quads: 'Quads',
        hamstrings: 'Hamstrings',
        core: 'Core',
        calves: 'Calves',
      },
    },
  },
  de: {
    intro: {
      hero: {
        kicker: 'Warum ADDAPT heraussticht',
        title: 'Eine App fuer Trainingsplan, Fortschritt, Ernaehrung und Regeneration',
        copy: 'Statt dir einmal einen festen Plan zu geben, passt ADDAPT dein Training und deine Ernaehrung laufend an echte Check-ins, gespeicherte Lifts, Gewichtstrends und deinen Erholungsstatus an.',
        pill1: 'Addaptiver Trainingssplit',
        pill2: 'Automatische Kalorienanpassung',
        pill3: 'Gewichtsanalyse',
        pill4: 'Zielbasierter Sauna-Guide',
      },
      tour: {
        kicker: 'So nutzt du ADDAPT',
        title: 'Einchecken, trainieren, loggen, verbessern',
        copy: 'Die App funktioniert am besten, wenn du diesen Kreislauf nutzt: Status updaten, Plan ausfuehren, Lifts loggen und den naechsten Block von ADDAPT anhand deiner echten Woche anpassen lassen.',
        f1: {
          title: 'Der Check-In steuert den Plan',
          copy: 'Energie, Schlaf, Ernaehrung, Lifts und Koerpergewicht fuettern die adaptive Engine, damit Kalorien und Trainingsmodus zu deiner echten Woche passen.',
        },
        f2: {
          title: 'Training und Analytik greifen ineinander',
          copy: 'Current Plan zeigt den Split, Log Session speichert die Leistung und Strength Progress macht daraus PR-Tracking, Charts und eine brauchbare Gewichtshistorie.',
        },
        f3: {
          title: 'Regeneration bekommt ein eigenes System',
          copy: 'Der Sauna Calculator liefert je nach Ziel einen Leitfaden fuer Cardio, Stress, Regeneration oder Langlebigkeit inklusive Protokoll, Timer, Hydration und Wochenplanung.',
        },
        safari:
          'In Safari: Tippe auf Teilen und dann auf Zum Home-Bildschirm fuer das volle native App-Gefuehl.',
        legal:
          'Gedacht fuer allgemeine Fitness- und Regenerationsplanung. Bei Verletzungen, Symptomen oder medizinischen Entscheidungen sollte eine qualifizierte Fachperson uebernehmen.',
      },
    },
    home: {
      greeting: 'Hi {name}',
      goalSub: '{goal}-Plan aktiv',
      streak: {
        title: '{count}-Wochen-Serie',
        done: 'Diese Woche ist schon gesichert.',
        pending: 'Ein Check-In diese Woche haelt die Serie am Leben.',
      },
      checkin: {
        today: 'Du hast heute schon eingecheckt — du kannst jederzeit erneut aktualisieren',
        yesterday: 'Letzter Check-In: gestern — Plan aktualisieren?',
        daysAgo: 'Letzter Check-In: vor {days} Tagen — jetzt deinen Plan aktualisieren',
      },
      card: {
        checkin: {
          title: 'Check-In',
          desc: 'Energie, Lifts und Ernaehrung eintragen — dein Plan wird sofort angepasst',
        },
        plan: {
          title: 'Aktueller Plan',
          desc: 'Deinen personalisierten Trainings- und Ernaehrungsplan ansehen',
        },
        log: {
          title: 'Session loggen',
          desc: 'Heutige Lifts speichern und Kraftfortschritt verfolgen',
        },
        emom: {
          title: 'EMOM',
          desc: 'Schnelle Minutentakte mit automatischer Satzzaehlung',
        },
        strength: {
          title: 'Kraftfortschritt',
          desc: 'Uebungs-Charts, PRs und Volumen',
        },
        sauna: {
          title: 'Sauna Calculator',
          badge: 'Neu',
          desc: 'Hitzeprotokoll, Timer, Hydration und Wochenplanung fuer deine Regeneration',
        },
        history: {
          title: 'Check-In-Verlauf',
          desc: 'Gewichtskurve und alle bisherigen Check-ins',
        },
        settings: {
          title: 'Einstellungen und Profil',
          desc: 'Ziele, Kalorien, Fokusmuskeln und Session-Laenge anpassen',
        },
      },
    },
    walkthrough: {
      step: 'Feature {current} von {total}',
      spotlight: 'Gerade sichtbar',
      skip: 'Ueberspringen',
      next: 'Weiter',
      finish: 'Fertig',
      checkin: {
        title: 'Check-In',
        copy: 'Hier startest du am haeufigsten. Dieser Bereich aktualisiert Kalorien, Erholungsmodus, Trainingsfokus und die naechste Version deines Plans anhand echter Daten.',
      },
      plan: {
        title: 'Aktueller Plan',
        copy: 'Das ist dein live adaptierter Split. Hier siehst du Sessions, Set-Bank-Logik, Frequenz und warum die Woche genau so aufgebaut ist.',
      },
      log: {
        title: 'Session loggen',
        copy: 'Speichere nach dem Training deine Lifts, damit ADDAPT Vorschlaege auf echter Leistung statt auf Schaetzungen aufbaut.',
      },
      strength: {
        title: 'Kraftfortschritt',
        copy: 'Verfolge PRs, Lasttrends, Volumen und Gewichtsentwicklung, damit Fortschritt sichtbar und messbar wird.',
      },
      sauna: {
        title: 'Sauna Calculator',
        copy: 'Nutze zielbasierte Sauna-Empfehlungen fuer Regeneration, Cardio, Stressabbau oder Langlebigkeit inklusive Protokoll, Timer, Hydration und Wochenplanung.',
      },
      history: {
        title: 'Check-In-Verlauf',
        copy: 'Sieh dir Gewicht, alte Check-ins und Planveraenderungen ueber ganze Bloecke hinweg an statt nur ueber einzelne Tage.',
      },
      settings: {
        title: 'Einstellungen und Profil',
        copy: 'Passe Ziele, Session-Laenge, Fokusmuskeln und andere Inputs an, sobald sich deine Prioritaeten aendern.',
      },
    },
    settings: {
      title: 'Profil und Einstellungen',
      redo: 'Onboarding erneut starten',
      reset: 'Meine Daten zuruecksetzen',
      signout: 'Abmelden',
      helper: 'Tippe auf Onboarding erneut starten, um deine Angaben zu aktualisieren.',
      language: 'Sprache',
      exportData: 'Daten exportieren',
      label: {
        goal: 'Ziel',
        sex: 'Geschlecht',
        age: 'Alter',
        experience: 'Erfahrung',
        days: 'Tage/Woche',
        session: 'Session-Laenge',
        focus: 'Fokusmuskeln',
        equipment: 'Equipment',
        diet: 'Ernaehrungsziel',
        goalWeight: 'Zielgewicht',
      },
    },
    history: {
      loading: 'Wird geladen...',
      empty: 'Noch keine Check-ins.',
      today: 'Heute',
      yesterday: 'Gestern',
      daysAgo: 'vor {days} Tagen',
      energy: 'Energie',
    },
    toast: {
      welcome: { title: 'Willkommen bei ADDAPT', body: 'Dein personalisierter Plan ist bereit.' },
      resetFail: {
        title: 'Zuruecksetzen fehlgeschlagen',
        body: 'Deine Daten konnten gerade nicht geloescht werden.',
      },
      resetDone: {
        title: 'Daten zurueckgesetzt',
        body: 'Dein Account ist bereit fuer einen frischen Start.',
      },
      offlineSaved: {
        title: 'Offline gespeichert',
        body: 'Deine Aenderungen sind lokal gespeichert und werden synchronisiert, sobald du wieder online bist.',
      },
      queueDrained: {
        title: 'Synchronisiert',
        body: 'Deine Offline-Aenderungen wurden in der Cloud gespeichert.',
      },
    },
    confirm: {
      reset: 'Profil, Check-ins und geloggte Sessions loeschen und neu starten?',
    },
    level: { rookie: 'Rookie', consistent: 'Konstant', dedicated: 'Engagiert', elite: 'Elite' },
    enum: {
      goal: {
        vtaper: 'V-Taper',
        hourglass: 'Hourglass',
        strength: 'Kraft',
        general: 'Allgemeine Fitness',
      },
      experience: {
        beginner: 'Anfaenger',
        intermediate: 'Fortgeschritten',
        advanced: 'Sehr fortgeschritten',
      },
      sex: { male: 'Maennlich', female: 'Weiblich', other: 'Divers' },
      equipment: {
        full: 'Volles Gym',
        dumbbells: 'Nur Kurzhanteln',
        bands: 'Widerstandsbaender',
        none: 'Nur Koerpergewicht',
      },
      dietGoal: { bulk: 'Aufbau', maintain: 'Erhalten', cut: 'Diaet' },
      muscle: {
        chest: 'Brust',
        back: 'Ruecken',
        shoulders: 'Schultern',
        biceps: 'Bizeps',
        triceps: 'Trizeps',
        glutes: 'Glutes',
        quads: 'Quadrizeps',
        hamstrings: 'Hamstrings',
        core: 'Core',
        calves: 'Waden',
      },
    },
  },
};

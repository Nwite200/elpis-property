// Elpis Property Limited — single source of truth for the logo intro.
// Change INTRO_STYLE to "classic" for the plain elegant variant.
// Change INTRO_MODE to "full" to restore the 15-second cinematic intro.
// No other code change is required to switch styles.
window.ELPIS_INTRO_CONFIG = {
  INTRO_STYLE: "hype", // "hype" | "classic"
  INTRO_MODE: "quick", // "quick" (3.8s) | "full" (15s legacy)
  // One-line rollback: set to "short" to replay the 1.2s transition on every
  // internal navigation again. "off" plays the intro only on a direct load.
  INTRO_INTERNAL: "off", // "off" | "short"
  LOGO_SRC: "assets/images/elpis-property-logo-original.png",
  BRAND_NAME: "ELPIS PROPERTY LIMITED",
  TAGLINE: "Spaces. Assets. Possibilities.",

  COLORS: {
    accent: "#e8b52d",
    accentBright: "#f4d06a",
    charcoal: "#071747",
    dark: "#071747",
    soft: "#f7f6f2",
    white: "#ffffff"
  },

  QUICK: {
    hype: {
      total: 3800,
      streak: { start: 0, duration: 260 },
      logo: { start: 180, duration: 420 },
      glitch: { start: 420, duration: 100 },
      impact: 700,
      shake: { start: 700, duration: 120 },
      ring: { start: 700, duration: 900 },
      speed: { start: 700, end: 1800 },
      sweep: { start: 800, duration: 1200 },
      lines: { start: 500, duration: 1300 },
      tagline: { start: 1600, duration: 500 },
      hold: { start: 2100, end: 3000 },
      exit: { start: 3000, duration: 800 },
      failsafe: 4800
    },
    classic: {
      total: 2400,
      fadeIn: 500,
      hold: 1100,
      fadeOut: 500,
      failsafe: 3200
    }
  },

  FULL: {
    hype: {
      total: 15000,
      streak: { start: 0, duration: 1100 },
      logo: { start: 900, duration: 1300 },
      glitch: { start: 1500, duration: 160 },
      impact: 2500,
      shake: { start: 2500, duration: 180 },
      ring: { start: 2500, duration: 1800 },
      speed: { start: 2500, end: 6000 },
      sweep: { start: 2600, duration: 3800 },
      lines: { start: 1900, duration: 4600 },
      tagline: { start: 5200, duration: 900 },
      hold: { start: 6200, end: 13200 },
      exit: { start: 13200, duration: 1800 },
      failsafe: 16000
    },
    classic: {
      total: 2700,
      fadeIn: 600,
      hold: 1500,
      fadeOut: 600,
      failsafe: 3500
    }
  },

  SHORT: {
    hype: {
      total: 1200,
      streak: { start: 0, duration: 180 },
      logo: { start: 120, duration: 240 },
      glitch: { start: 120, duration: 70 },
      impact: 360,
      shake: { start: 360, duration: 70 },
      ring: { start: 360, duration: 420 },
      speed: { start: 360, end: 760 },
      sweep: { start: 360, duration: 520 },
      lines: { start: 300, duration: 480 },
      tagline: { start: 0, duration: 0 },
      hold: { start: 760, end: 930 },
      exit: { start: 930, duration: 270 },
      failsafe: 1700
    },
    classic: {
      total: 1350,
      fadeIn: 350,
      hold: 650,
      fadeOut: 350,
      failsafe: 2000
    }
  },

  REDUCED: {
    total: 600,
    fadeIn: 250,
    hold: 100,
    fadeOut: 250,
    failsafe: 1100
  }
};

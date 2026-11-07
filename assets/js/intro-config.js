// Elpis Property Limited — single source of truth for the logo intro.
// Change INTRO_STYLE to "classic" for the plain elegant variant.
// No other code change is required to switch styles.
window.ELPIS_INTRO_CONFIG = {
  INTRO_STYLE: "hype", // "hype" | "classic"
  LOGO_SRC: "assets/images/elpis-property-logo-original.png",
  BRAND_NAME: "ELPIS PROPERTY LIMITED",
  TAGLINE: "Spaces. Assets. Possibilities.",

  COLORS: {
    accent: "#C5A16B",
    accentBright: "#E9D8B9",
    charcoal: "#142C27",
    dark: "#0D211D",
    soft: "#F5F2EC",
    white: "#FFFFFF"
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

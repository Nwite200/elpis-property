// Elpis Property Limited — single source of truth for the logo intro.
// Change INTRO_STYLE to "classic" for the plain elegant variant.
// No other code change is required to switch styles.
window.ELPIS_INTRO_CONFIG = {
  INTRO_STYLE: "hype", // "hype" | "classic"
  LOGO_SRC: "assets/images/elpis-property-logo-original.png",
  BRAND_NAME: "ELPIS PROPERTY LIMITED",
  TAGLINE: "Your Future Begins With the Right Property.",

  COLORS: {
    accent: "#C6A45C",
    accentBright: "#E2C98B",
    charcoal: "#17243A",
    dark: "#0B1424",
    soft: "#F5F3EE",
    white: "#FFFFFF"
  },

  FULL: {
    hype: {
      total: 3000,
      streak: { start: 0, duration: 300 },
      logo: { start: 300, duration: 500 },
      glitch: { start: 300, duration: 110 },
      impact: 800,
      shake: { start: 800, duration: 120 },
      ring: { start: 800, duration: 650 },
      speed: { start: 800, end: 1600 },
      sweep: { start: 800, duration: 1500 },
      lines: { start: 800, duration: 1000 },
      tagline: { start: 1600, duration: 300 },
      hold: { start: 1600, end: 2300 },
      exit: { start: 2300, duration: 700 },
      failsafe: 3800
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
      total: 1000,
      streak: { start: 0, duration: 100 },
      logo: { start: 100, duration: 170 },
      glitch: { start: 100, duration: 70 },
      impact: 270,
      shake: { start: 270, duration: 90 },
      ring: { start: 270, duration: 430 },
      speed: { start: 270, end: 540 },
      sweep: { start: 270, duration: 500 },
      lines: { start: 270, duration: 400 },
      tagline: { start: 0, duration: 0 },
      hold: { start: 540, end: 760 },
      exit: { start: 760, duration: 240 },
      failsafe: 1800
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

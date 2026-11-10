// Pronunciation and text normalisation for HeadTTS.
// This changes how text is spoken, never what the caption says. Kokoro is an
// English model; Nigerian English is approximated with an approved dictionary
// of names, places, currency and business terms.

const PRONUNCIATIONS = [
  // People
  ["Adaora", "ah-dor-ah"],
  ["Chiamaka", "chee-ah-mah-kah"],
  ["Emeka", "eh-meh-kah"],
  ["Ngozi", "n-goh-zee"],
  ["Ifeoma", "ee-feh-oh-mah"],
  ["Amara", "ah-mah-rah"],
  ["Solomon", "sol-oh-mon"],
  ["Abuja", "ah-boo-jah"],
  ["Nyanya", "nyan-yah"],
  ["Gwarinpa", "gwah-rin-pah"],
  ["Maitama", "my-tah-mah"],
  ["Wuse", "woo-seh"],
  ["Kubwa", "koo-bwah"],
  ["Lugbe", "loog-beh"],
  ["Karu", "kah-roo"],
  ["Ibeju-Lekki", "ee-beh-joo lekki"],
  ["Lekki", "lekki"],
  ["Ikeja", "ee-keh-jah"],
  ["Surulere", "shoo-roo-leh-reh"],
  ["Owerri", "oh-weh-ree"],
  ["Uyo", "oo-yoh"],
  ["Asaba", "ah-sah-bah"],
  ["Port Harcourt", "port har-kurt"],
  // Property and finance
  ["ELPIS ACCESS", "Elpis Access"],
  ["ELPIS", "Elpis"],
  ["C of O", "Certificate of Occupancy"],
  ["sqm", "square metres"],
  ["sq. m", "square metres"],
  ["kobo", "koh-boh"]
];

const UNITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function underThousand(value) {
  const parts = [];
  let n = value;
  if (n >= 100) {
    parts.push(`${UNITS[Math.floor(n / 100)]} hundred`);
    n %= 100;
    if (n) parts.push("and");
  }
  if (n >= 20) {
    const ten = TENS[Math.floor(n / 10)];
    const rest = n % 10;
    parts.push(rest ? `${ten}-${UNITS[rest]}` : ten);
  } else if (n > 0) {
    parts.push(UNITS[n]);
  }
  return parts.join(" ");
}

export function numberToWords(value) {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (!n) return "zero";
  const scales = ["", "thousand", "million", "billion", "trillion"];
  const groups = [];
  let scale = 0;
  while (n > 0 && scale < scales.length) {
    const group = n % 1000;
    if (group) groups.unshift(`${underThousand(group)}${scales[scale] ? ` ${scales[scale]}` : ""}`);
    n = Math.floor(n / 1000);
    scale += 1;
  }
  return groups.join(" ").replace(/\s+/g, " ").trim();
}

function currencyToWords(text) {
  return text
    .replace(/₦\s*([\d,]+(?:\.\d+)?)\s*(million|m|thousand|k)?/gi, (_, raw, unit) => {
      let value = Number(String(raw).replace(/,/g, ""));
      const suffix = String(unit || "").toLowerCase();
      if (suffix === "million" || suffix === "m") value *= 1000000;
      if (suffix === "thousand" || suffix === "k") value *= 1000;
      if (!Number.isFinite(value)) return _;
      return `${numberToWords(value)} naira`;
    })
    .replace(/\bNGN\b/gi, "naira")
    .replace(/\bnaira\s+naira\b/gi, "naira");
}

function applyDictionary(text) {
  let out = text;
  for (const [term, spoken] of PRONUNCIATIONS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/-/g, "[- ]?");
    out = out.replace(new RegExp(`\\b${escaped}\\b`, "gi"), spoken);
  }
  return out;
}

export function prepareForSpeech(input) {
  let text = String(input || "")
    .replace(/\u00a0/g, " ")
    .replace(/&/g, " and ")
    .replace(/\bpercent\b/gi, "per cent")
    .replace(/\bNo\.\s*(\d)/gi, "number $1")
    .replace(/\s+/g, " ")
    .trim();
  text = currencyToWords(text);
  text = applyDictionary(text);
  return text;
}

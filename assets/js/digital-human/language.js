// Language direction for the assistant: Auto, Nigerian Pidgin and English.
// Pidgin is understood through a deterministic lexicon/grammar mapping. Spoken
// Pidgin uses the same English neural voices with pronunciation overrides; we
// never claim a native Pidgin TTS model.

export const LANGUAGE_KEY = "elp-dh-language";

const STRONG_MARKERS = [
  "abeg", "wahala", "wetin", "dey", "wan", "una", "no wahala", "how far", "e be",
  "go take", "never reflect", "make you", "sabi", "shey", "abi", "oya", "waka",
  "chop", "gist", "na so", "e don", "i don", "dem", "sef", "biko", "nna", "omo", "no understand"
];
const WEAK_MARKERS = ["na", "e", "am", "go", "fit", "don"];

export function detectPidgin(text) {
  const lower = String(text || "").toLowerCase();
  if (!lower.trim()) return false;
  const strong = STRONG_MARKERS.filter(marker => new RegExp(`(^|\\s)${marker}(\\s|$|[,.!?])`).test(lower));
  if (strong.length) return true;
  const weak = WEAK_MARKERS.filter(marker => new RegExp(`(^|\\s)${marker}(\\s|$|[,.!?])`).test(lower));
  return weak.length >= 3;
}

const INTENT_MAP = [
  [/\bhow much e be\b/i, "what is the price of the property"],
  [/\bi wan buy\b/i, "i want to buy"],
  [/\bi dey find\b/i, "i am looking for"],
  [/\bi wan find\b/i, "i want to find"],
  [/\bwetin una get\b/i, "what do you have"],
  [/\bshow me wetin una get\b/i, "show me what you have"],
  [/\bi don pay\b/i, "i have paid"],
  [/\bmy payment never reflect\b/i, "my payment has not reflected"],
  [/\bi no understand\b/i, "i do not understand"],
  [/\bmake you explain am again\b/i, "explain it again"],
  [/\bi wan talk to human being\b/i, "i want to talk to a human"],
  [/\bi wan talk to person\b/i, "i want to talk to a human"],
  [/\bhow i go take register\b/i, "how do i register"],
  [/\bhow i go register\b/i, "how do i register"],
  [/\bno wahala\b/i, "no problem"],
  [/\babeg\b/i, "please"],
  [/\bwetin\b/i, "what"],
  [/\buna\b/gi, "you"],
  [/\bdey\b/gi, "is"],
  [/\bwan\b/gi, "want"],
  [/\bdon\b/gi, "have"],
  [/\bgo\b/gi, "will"]
];

export function toEnglishIntent(text) {
  let out = String(text || "");
  for (const [pattern, replacement] of INTENT_MAP) out = out.replace(pattern, replacement);
  return out.replace(/\s+/g, " ").trim();
}

export function readLanguagePreference() {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY);
    return ["english", "pidgin"].includes(value) ? value : "auto";
  } catch (_) {
    return "auto";
  }
}

export function writeLanguagePreference(value) {
  const mode = ["english", "pidgin"].includes(value) ? value : "auto";
  try { localStorage.setItem(LANGUAGE_KEY, mode); } catch (_) { /* ignore */ }
  return mode;
}

export function resolveReplyLanguage(text, preference) {
  if (preference === "pidgin") return "pidgin";
  if (preference === "english") return "english";
  return detectPidgin(text) ? "pidgin" : "english";
}

const PIDGIN = {
  greeting: "How far. I be Adaora — I dey help people find house, check account and talk to the Elpis team. Wetin you want make we do?",
  property: "No wahala, I check the house dem for you.",
  viewing: "We fit arrange viewing. Send the team message or open the property page, and we go route am to the right branch.",
  payment: "Your payment and receipt dey inside the client portal. Sign in make you see am. If payment never reflect, the team go check am for you.",
  account: "I go take you to your dashboard. Your permission still apply inside.",
  register: "To register, you go need your name, phone and email. The form go tell you if something no complete.",
  human: "I go find person for you. Choose who you want make I connect you to — the person must accept before the transfer start.",
  summary: "See your summary so:",
  help: "I fit help you with house, account, payment, or connect you to person. Ask me anything.",
  who: "I be Adaora, Elpis Property concierge. I be digital assistant, not human. The specialist team dey join me for different work.",
  thanks: "No wahala. If you need anything else, I dey here.",
  compare: "See how the house dem compare:",
  fallback: "I no too understand. You can ask me about house, account, payment, or talk to person."
};

export function pidginLead(intentKey) {
  return PIDGIN[intentKey] || PIDGIN.fallback;
}

export function localizeReply(reply, language, intentKey) {
  if (language !== "pidgin" || !reply) return reply;
  const lead = pidginLead(intentKey);
  const dataIntents = ["property", "summary", "compare"];
  if (dataIntents.includes(intentKey)) {
    return { ...reply, text: `${lead} ${reply.text}` };
  }
  return { ...reply, text: lead };
}

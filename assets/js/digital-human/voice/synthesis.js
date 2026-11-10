// Speech synthesis with male/female voice preference and safe fallbacks.
// Voice names carry no standard gender field, so selection is a documented
// heuristic over locale and common voice names, never a pitch-shifted fake.

const FEMALE_HINTS = ["female", "woman", "samantha", "victoria", "karen", "moira", "tessa", "zira", "susan", "fiona", "serena", "kate", "ava", "aria", "jenny", "sonia", "emma", "amelie", "joanna", "salli", "kendra", "kimberly", "chiamaka", "ngozi", "amara", "ifeoma"];
const MALE_HINTS = ["male", "man", "daniel", "alex", "david", "mark", "george", "ryan", "guy", "fred", "tom", "oliver", "arthur", "matthew", "james", "brian", "liam", "christopher", "eric", "solomon", "emeka"];

function nameHas(name, list) {
  const lower = String(name || "").toLowerCase();
  return list.some(token => lower === token || lower.startsWith(token + " ") || lower.includes(token));
}

export class VoiceSynthesis {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.voices = [];
    this.voiceName = "";
    this.speaking = false;
    this.current = null;
    this.onStateChange = null;
    this.resumeTimer = null;
    this.refreshVoices();
    if (this.synth && typeof this.synth.addEventListener === "function") {
      this.synth.addEventListener("voiceschanged", () => this.refreshVoices());
    }
  }

  refreshVoices() {
    try {
      this.voices = this.synth ? this.synth.getVoices() || [] : [];
    } catch (_) {
      this.voices = [];
    }
    return this.voices;
  }

  pickVoice(profile) {
    this.refreshVoices();
    if (!this.voices.length) return null;
    const wantedLang = String(profile.lang || "en").toLowerCase();
    const base = wantedLang.split("-")[0];
    const preferred = (profile.preferredNames || []).map(n => String(n).toLowerCase());
    const gender = profile.genderHint || "";
    let best = null;
    let bestScore = -Infinity;
    for (const voice of this.voices) {
      const lang = String(voice.lang || "").toLowerCase();
      const name = String(voice.name || "");
      let score = 0;
      if (lang === wantedLang) score += 60;
      else if (lang === `${base}-ng`) score += 55;
      else if (["en-gb", "en-za", "en-ke", "en-gh"].includes(lang)) score += 35;
      else if (lang.startsWith(base)) score += 25;
      const preferredIndex = preferred.findIndex(p => name.toLowerCase().includes(p));
      if (preferredIndex >= 0) score += 30 - preferredIndex * 3;
      if (gender === "female") {
        if (nameHas(name, FEMALE_HINTS)) score += 18;
        if (nameHas(name, MALE_HINTS)) score -= 22;
      } else if (gender === "male") {
        if (nameHas(name, MALE_HINTS)) score += 18;
        if (nameHas(name, FEMALE_HINTS)) score -= 22;
      }
      if (voice.localService) score += 4;
      if (voice.default) score += 2;
      if (score > bestScore) { bestScore = score; best = voice; }
    }
    return best || this.voices[0] || null;
  }

  chunk(text, limit = 180) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return [];
    const sentences = clean.match(/[^.!?]+[.!?]?/g) || [clean];
    const chunks = [];
    let buffer = "";
    for (const sentence of sentences) {
      const part = sentence.trim();
      if (!part) continue;
      if ((buffer + " " + part).trim().length <= limit) {
        buffer = (buffer + " " + part).trim();
      } else {
        if (buffer) chunks.push(buffer);
        if (part.length <= limit) buffer = part;
        else {
          const words = part.split(" ");
          let line = "";
          for (const word of words) {
            if ((line + " " + word).trim().length > limit) {
              if (line) chunks.push(line.trim());
              line = word;
            } else {
              line = (line + " " + word).trim();
            }
          }
          buffer = line;
        }
      }
    }
    if (buffer) chunks.push(buffer);
    return chunks;
  }

  speak(text, profile, { onStart, onEnd, onError } = {}) {
    if (!this.synth) return false;
    this.cancel(true);
    const chunks = this.chunk(text);
    if (!chunks.length) return false;
    const voice = this.pickVoice(profile);
    this.voiceName = voice ? voice.name : "";
    this.speaking = true;
    this.onStateChange && this.onStateChange({ speaking: true, voiceName: this.voiceName });
    const queue = chunks.slice();
    const speakNext = () => {
      const part = queue.shift();
      if (!part) {
        this.finish(onEnd);
        return;
      }
      const utterance = new window.SpeechSynthesisUtterance(part);
      utterance.lang = profile.lang || "en-NG";
      utterance.rate = Number(profile.rate) || 1;
      utterance.pitch = Number(profile.pitch) || 1;
      utterance.volume = 1;
      if (voice) utterance.voice = voice;
      utterance.onstart = () => { onStart && onStart(); };
      utterance.onend = () => speakNext();
      utterance.onerror = event => {
        const reason = event && event.error ? event.error : "unknown";
        if (reason === "interrupted" || reason === "canceled") return;
        this.finish(onEnd);
        onError && onError(reason);
      };
      this.current = utterance;
      try {
        this.synth.speak(utterance);
      } catch (_) {
        this.finish(onEnd);
        onError && onError("synthesis-failed");
      }
    };
    if (this.resumeTimer) clearInterval(this.resumeTimer);
    this.resumeTimer = setInterval(() => {
      try { if (this.synth.speaking) this.synth.resume(); } catch (_) { /* ignore */ }
    }, 10000);
    speakNext();
    return true;
  }

  finish(onEnd) {
    this.speaking = false;
    this.current = null;
    if (this.resumeTimer) { clearInterval(this.resumeTimer); this.resumeTimer = null; }
    this.onStateChange && this.onStateChange({ speaking: false, voiceName: this.voiceName });
    onEnd && onEnd();
  }

  cancel(silent = false) {
    if (this.synth) {
      try { this.synth.cancel(); } catch (_) { /* ignore */ }
    }
    if (this.resumeTimer) { clearInterval(this.resumeTimer); this.resumeTimer = null; }
    const wasSpeaking = this.speaking;
    this.speaking = false;
    this.current = null;
    if (wasSpeaking && !silent) {
      this.onStateChange && this.onStateChange({ speaking: false, voiceName: this.voiceName });
    }
  }
}

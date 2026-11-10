// Persona → HeadTTS/Kokoro voice mapping. Nine distinct voices, no pitch tricks.
// Kokoro English voices are en-us/en-gb only; the pronunciation layer handles
// Nigerian names, places and naira amounts.

export const KOKORO_VOICES = {
  adaora: "af_bella",
  solomon: "am_fenrir",
  chiamaka: "af_heart",
  emeka: "am_michael",
  amara: "af_nicole",
  david: "am_puck",
  ngozi: "bf_emma",
  daniel: "bm_george",
  ifeoma: "af_sky"
};

export const KOKORO_VOICE_LABELS = {
  af_bella: "Bella (US female)",
  am_fenrir: "Fenrir (US male)",
  af_heart: "Heart (US female)",
  am_michael: "Michael (US male)",
  af_nicole: "Nicole (US female)",
  am_puck: "Puck (US male)",
  bf_emma: "Emma (UK female)",
  bm_george: "George (UK male)",
  af_sky: "Sky (US female)"
};

export function kokoroVoiceFor(personaKey) {
  return KOKORO_VOICES[personaKey] || "af_bella";
}

export function kokoroSpeedFor(persona) {
  const rate = Number(persona && persona.voice && persona.voice.rate);
  return Number.isFinite(rate) ? Math.min(1.4, Math.max(0.75, rate)) : 1;
}

export const ENGINE_KEY = "elp-dh-voice-engine";
export function readEnginePreference() {
  // Device voice is the reliable default; neural is opt-in until its model
  // loading is verified on the target device/network.
  try {
    if (localStorage.getItem("elp-dh-engine-v2") !== "1") {
      localStorage.setItem("elp-dh-engine-v2", "1");
      localStorage.setItem(ENGINE_KEY, "device");
      return "device";
    }
    return localStorage.getItem(ENGINE_KEY) === "neural" ? "neural" : "device";
  } catch (_) {
    return "device";
  }
}
export function writeEnginePreference(engine) {
  try { localStorage.setItem(ENGINE_KEY, engine === "device" ? "device" : "neural"); } catch (_) { /* ignore */ }
}

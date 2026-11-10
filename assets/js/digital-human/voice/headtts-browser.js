// HeadTTS browser adapter (Kokoro, WebGPU with WASM fallback).
// Lazily imports the vendored module and loads the model only when neural
// speech is actually requested. Falls back by throwing, so the selector can
// try server inference and then the device voice.

import { kokoroVoiceFor, kokoroSpeedFor } from "./voice-config.js";

const MODULE_URL = "/assets/headtts/modules/headtts.mjs";
const WORKER_URL = "/assets/headtts/modules/worker-tts.mjs";
const DICTIONARY_URL = "/assets/headtts/dictionaries/";
const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0/dist/transformers.min.js";

let shared = null;
let initPromise = null;

export function headttsSupport() {
  return {
    wasm: typeof WebAssembly === "object",
    webgpu: !!(navigator.gpu && typeof navigator.gpu.requestAdapter === "function")
  };
}

async function initialize(onStatus) {
  if (shared) return shared;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    onStatus && onStatus("Loading neural voice module…");
    const { HeadTTS } = await import(/* @vite-ignore */ MODULE_URL);
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const instance = new HeadTTS({
      endpoints: ["webgpu", "wasm"],
      audioCtx,
      workerModule: new URL(WORKER_URL, window.location.origin).href,
      dictionaryURL: new URL(DICTIONARY_URL, window.location.origin).href,
      transformersModule: TRANSFORMERS_URL,
      languages: ["en-us"],
      voices: [],
      defaultVoice: "af_bella",
      defaultLanguage: "en-us",
      dtypeWebgpu: "q4f16",
      dtypeWasm: "q4",
      splitSentences: true,
      splitLength: 400
    });
    instance.onerror = error => {
      onStatus && onStatus("Neural voice error: " + (error && error.message ? error.message : "unknown"));
    };
    onStatus && onStatus("Loading neural voice model… first use can take a while.");
    await instance.connect();
    shared = { instance, audioCtx, sources: [], timers: [] };
    onStatus && onStatus("Neural voice ready.");
    return shared;
  })();
  try {
    return await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}

function clearPlayback(state) {
  for (const timer of state.timers) clearTimeout(timer);
  state.timers = [];
  for (const source of state.sources) {
    try { source.stop(); } catch (_) { /* already stopped */ }
  }
  state.sources = [];
}

export class HeadTTSBrowser {
  constructor() {
    this.state = null;
    this.stopped = false;
  }

  async speak(text, persona, { onStatus, onStart, onViseme, onEnd } = {}) {
    const state = await initialize(onStatus);
    this.state = state;
    this.stopped = false;
    clearPlayback(state);
    if (state.audioCtx.state === "suspended") await state.audioCtx.resume();
    state.instance.setup({
      voice: kokoroVoiceFor(persona.key),
      language: "en-us",
      speed: kokoroSpeedFor(persona),
      audioEncoding: "wav"
    });
    onStatus && onStatus("Synthesising neural voice…");
    const messages = await state.instance.synthesize({ input: text });
    const audioMessages = (messages || []).filter(message => message.type === "audio" && message.data && message.data.audio);
    if (!audioMessages.length) throw new Error("HeadTTS returned no audio");
    onStart && onStart();
    for (const message of audioMessages) {
      if (this.stopped) break;
      await this.play(message.data, state, onViseme);
    }
    if (!this.stopped) onEnd && onEnd();
  }

  play(data, state, onViseme) {
    return new Promise(resolve => {
      const source = state.audioCtx.createBufferSource();
      source.buffer = data.audio;
      source.connect(state.audioCtx.destination);
      const startAt = state.audioCtx.currentTime + 0.03;
      source.start(startAt);
      state.sources.push(source);
      const visemes = data.visemes || [];
      const vtimes = data.vtimes || [];
      const vdurations = data.vdurations || [];
      for (let i = 0; i < visemes.length; i += 1) {
        const delay = Math.max(0, startAt * 1000 - state.audioCtx.currentTime * 1000 + (vtimes[i] || 0));
        const timer = setTimeout(() => {
          if (!this.stopped) onViseme && onViseme(visemes[i], vtimes[i] || 0, vdurations[i] || 60);
        }, delay);
        state.timers.push(timer);
      }
      const finish = () => {
        state.sources = state.sources.filter(item => item !== source);
        resolve();
      };
      source.onended = finish;
      const duration = Number(data.audio.duration || 0);
      const fallback = setTimeout(finish, Math.max(500, duration * 1000 + 250));
      state.timers.push(fallback);
    });
  }

  stop() {
    this.stopped = true;
    if (this.state) clearPlayback(this.state);
  }

  getCapabilities() {
    return headttsSupport();
  }
}

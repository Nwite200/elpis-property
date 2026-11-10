// HeadTTS server adapter. The browser calls the authenticated Worker proxy,
// which forwards to a separately hosted HeadTTS REST service. Audio is never
// public and no conversation text is logged here.

import { kokoroSpeedFor } from "./voice-config.js";

let audioCtx = null;

function toArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export class HeadTTSServer {
  constructor() {
    this.sources = [];
    this.timers = [];
    this.stopped = false;
  }

  async speak(text, persona, { onStatus, onStart, onViseme, onEnd } = {}) {
    this.stopped = false;
    onStatus && onStatus("Requesting neural voice from the server…");
    const res = await fetch("/api/assistant/synthesize", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ text, persona: persona.key, speed: kokoroSpeedFor(persona) })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw Object.assign(new Error(data.error || "Server voice unavailable"), { status: res.status });
    }
    const data = await res.json();
    if (!data.audio_base64) throw new Error("Server returned no audio");
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const buffer = await audioCtx.decodeAudioData(toArrayBuffer(data.audio_base64));
    if (this.stopped) return;
    onStart && onStart();
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    const startAt = audioCtx.currentTime + 0.03;
    source.start(startAt);
    this.sources.push(source);
    const visemes = data.visemes || [];
    const vtimes = data.vtimes || [];
    const vdurations = data.vdurations || [];
    for (let i = 0; i < visemes.length; i += 1) {
      const delay = Math.max(0, 30 + (vtimes[i] || 0));
      const timer = setTimeout(() => {
        if (!this.stopped) onViseme && onViseme(visemes[i], vtimes[i] || 0, vdurations[i] || 60);
      }, delay);
      this.timers.push(timer);
    }
    await new Promise(resolve => {
      source.onended = resolve;
      const fallback = setTimeout(resolve, Math.max(500, buffer.duration * 1000 + 250));
      this.timers.push(fallback);
    });
    if (!this.stopped) onEnd && onEnd();
  }

  stop() {
    this.stopped = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
    for (const source of this.sources) {
      try { source.stop(); } catch (_) { /* already stopped */ }
    }
    this.sources = [];
  }
}

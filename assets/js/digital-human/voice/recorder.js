// Push-to-talk recorder. Browser-native recording + Cloudflare Workers AI
// transcription (free tier). No audio is stored; it is sent for transcription
// and discarded.

function pickMime() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  if (!window.MediaRecorder || typeof window.MediaRecorder.isTypeSupported !== "function") return "";
  return candidates.find(type => window.MediaRecorder.isTypeSupported(type)) || "";
}

export class VoiceRecorder {
  constructor() {
    this.supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    this.active = false;
    this.cancelled = false;
    this.stopFn = null;
  }

  async start({ onAutoStop } = {}) {
    if (!this.supported) throw Object.assign(new Error("unsupported"), { code: "unsupported" });
    let stream;
    try {
      stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ audio: true }),
        new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("microphone timeout"), { code: "microphone" })), 8000))
      ]);
    } catch (error) {
      throw Object.assign(new Error(error && error.message ? error.message : "microphone unavailable"), {
        code: error && error.code ? error.code : "microphone",
        name: error && error.name ? error.name : "Error"
      });
    }
    if (this.cancelled) {
      for (const track of stream.getTracks()) track.stop();
      return "";
    }
    const mime = pickMime();
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const chunks = [];
    this.active = true;
    this.cancelled = false;
    return new Promise((resolve, reject) => {
      let timer = null;
      let vadTimer = null;
      let vadCtx = null;
      let autoStopped = false;
      const stopForSilence = () => {
        if (autoStopped) return;
        autoStopped = true;
        onAutoStop && onAutoStop();
        if (recorder.state !== "inactive") recorder.stop();
      };
      // Simple energy-based end-of-speech detection so one tap is enough.
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          vadCtx = new AudioCtx();
          const sourceNode = vadCtx.createMediaStreamSource(stream);
          const analyser = vadCtx.createAnalyser();
          analyser.fftSize = 1024;
          sourceNode.connect(analyser);
          const data = new Uint8Array(analyser.fftSize);
          let spoke = false;
          let silenceSince = 0;
          const startedAt = Date.now();
          vadTimer = setInterval(() => {
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (const value of data) { const v = (value - 128) / 128; sum += v * v; }
            const rms = Math.sqrt(sum / data.length);
            const now = Date.now();
            if (rms > 0.025) { spoke = true; silenceSince = 0; }
            else if (spoke) {
              if (!silenceSince) silenceSince = now;
              else if (now - silenceSince > 1100) stopForSilence();
            }
            if (now - startedAt > 15000) stopForSilence();
          }, 100);
        }
      } catch (_) { /* VAD is optional; the manual stop and 15s cap remain */ }
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (vadTimer) clearInterval(vadTimer);
        if (vadCtx) { try { vadCtx.close(); } catch (_) {} }
        for (const track of stream.getTracks()) track.stop();
        this.active = false;
        this.stopFn = null;
      };
      recorder.ondataavailable = event => { if (event.data && event.data.size) chunks.push(event.data); };
      recorder.onerror = event => {
        cleanup();
        reject(Object.assign(new Error("recording failed"), { code: "recording" }));
      };
      recorder.onstop = async () => {
        cleanup();
        if (this.cancelled) { resolve(""); return; }
        const blob = new Blob(chunks, { type: recorder.mimeType || mime || "audio/webm" });
        if (!blob.size) { resolve(""); return; }
        try {
          const res = await fetch("/api/assistant/transcribe", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": blob.type || "audio/webm", Accept: "application/json" },
            body: blob
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            reject(Object.assign(new Error(data.error || "Transcription failed"), { code: res.status === 429 ? "rate" : "transcribe" }));
            return;
          }
          const data = await res.json();
          resolve(String(data.text || "").trim());
        } catch (error) {
          reject(Object.assign(new Error("Transcription failed"), { code: "network" }));
        }
      };
      this.stopFn = () => { if (recorder.state !== "inactive") recorder.stop(); };
      recorder.start();
      timer = setTimeout(stopForSilence, 15000);
    });
  }

  stop() {
    if (this.stopFn) this.stopFn();
  }

  cancel() {
    this.cancelled = true;
    this.stop();
  }

  destroy() {
    this.cancel();
  }
}

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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = pickMime();
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const chunks = [];
    this.active = true;
    this.cancelled = false;
    return new Promise((resolve, reject) => {
      let timer = null;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
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
      timer = setTimeout(() => {
        if (recorder.state !== "inactive") {
          onAutoStop && onAutoStop();
          recorder.stop();
        }
      }, 15000);
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

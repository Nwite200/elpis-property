// Speech recognition wrapper. One shot per activation, explicit microphone
// gesture, honest error states, no audio leaves the browser through us.

const ERROR_MESSAGES = {
  permission: "Microphone permission was blocked. Allow it in your browser settings, or type instead.",
  microphone: "No microphone was found. You can still type.",
  network: "Speech recognition needs a connection and could not reach the service. Please type instead.",
  "no-speech": "I didn't catch that. Try again, or type your message.",
  unsupported: "Speech input is not supported in this browser. Please type instead.",
  unknown: "Speech input stopped unexpectedly. Please try again or type."
};

export class VoiceRecognition {
  constructor(support) {
    this.Recognition = support.Recognition || null;
    this.rec = null;
    this.active = false;
    this.finalSent = false;
  }

  get supported() {
    return typeof this.Recognition === "function";
  }

  start({ lang = "en-NG", onInterim, onFinal, onError, onStart, onEnd } = {}) {
    if (!this.supported) {
      onError && onError(ERROR_MESSAGES.unsupported, "unsupported");
      return false;
    }
    if (this.active) return false;
    const begin = (chosenLang, allowFallback) => {
    let rec;
    try {
      rec = new this.Recognition();
    } catch (_) {
      onError && onError(ERROR_MESSAGES.unsupported, "unsupported");
      return false;
    }
    rec.lang = chosenLang || "en-GB";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    this.finalSent = false;

    rec.onstart = () => {
      this.active = true;
      onStart && onStart();
    };
    rec.onresult = event => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0] ? result[0].transcript : "";
        if (result.isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (interim) onInterim && onInterim(interim.trim());
      if (finalText && !this.finalSent) {
        this.finalSent = true;
        onFinal && onFinal(finalText.trim());
      }
    };
    rec.onerror = event => {
      const code = event && event.error ? event.error : "unknown";
      if (code === "language-not-supported" && allowFallback) {
        this.active = false;
        this.rec = null;
        begin(navigator.language && /^en/i.test(navigator.language) ? navigator.language : "en-GB", false);
        return;
      }
      const key = code === "not-allowed" || code === "service-not-allowed" ? "permission"
        : code === "audio-capture" ? "microphone"
        : code === "network" ? "network"
        : code === "no-speech" ? "no-speech"
        : code === "language-not-supported" ? "unsupported"
        : code === "aborted" ? "aborted"
        : "unknown";
      if (key === "aborted") return;
      onError && onError(ERROR_MESSAGES[key], key);
    };
    rec.onend = () => {
      if (this.rec !== rec) return;
      this.active = false;
      this.rec = null;
      onEnd && onEnd();
    };

    this.rec = rec;
    try {
      rec.start();
      return true;
    } catch (error) {
      this.rec = null;
      this.active = false;
      const message = error && error.name === "InvalidStateError"
        ? "Speech input is already starting. Try again."
        : ERROR_MESSAGES.unknown;
      onError && onError(message, "unknown");
      return false;
    }
    };
    return begin(lang || "en-GB", true);
  }

  stop() {
    if (this.rec) {
      try { this.rec.stop(); } catch (_) { /* ignore */ }
    }
  }

  abort() {
    if (this.rec) {
      try { this.rec.abort(); } catch (_) { /* ignore */ }
    }
    this.active = false;
    this.rec = null;
  }
}

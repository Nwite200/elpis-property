// Inference routing: browser HeadTTS → server HeadTTS → device speech.
// A failure at any stage falls through without blocking the conversation.

import { HeadTTSBrowser, headttsSupport } from "./headtts-browser.js";
import { HeadTTSServer } from "./headtts-server.js";
import { prepareForSpeech } from "./pronunciation.js";
import { readEnginePreference, writeEnginePreference } from "./voice-config.js";

const BROWSER_TIMEOUT_MS = 45000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Neural voice timed out")), ms))
  ]);
}

export class VoiceSelector {
  constructor({ signedIn = false } = {}) {
    this.signedIn = signedIn;
    this.engine = readEnginePreference();
    this.browser = new HeadTTSBrowser();
    this.server = new HeadTTSServer();
    this.route = "device";
    this.lastError = "";
  }

  setEngine(engine) {
    this.engine = engine === "device" ? "device" : "neural";
    writeEnginePreference(this.engine);
    this.stop();
  }

  getCapabilities() {
    return { ...headttsSupport(), signedIn: this.signedIn, engine: this.engine };
  }

  getStatus() {
    return { route: this.route, error: this.lastError, engine: this.engine };
  }

  async speak(text, persona, callbacks = {}) {
    const { onStatus, onError } = callbacks;
    if (this.engine === "device") {
      this.route = "device";
      return false;
    }
    const support = this.getCapabilities();
    const lowMemory = typeof navigator.deviceMemory === "number" && navigator.deviceMemory < 3;
    const browserViable = (support.webgpu || (support.wasm && !lowMemory));
    const spoken = prepareForSpeech(text);

    if (browserViable) {
      try {
        await withTimeout(this.browser.speak(spoken, persona, callbacks), BROWSER_TIMEOUT_MS);
        this.route = "browser";
        this.lastError = "";
        return true;
      } catch (error) {
        this.lastError = error && error.message ? error.message : "Browser neural voice failed";
        onStatus && onStatus("Neural browser voice unavailable — trying server…");
      }
    }

    if (this.signedIn) {
      try {
        await this.server.speak(spoken, persona, callbacks);
        this.route = "server";
        this.lastError = "";
        return true;
      } catch (error) {
        this.lastError = error && error.message ? error.message : "Server neural voice failed";
        onStatus && onStatus("Neural server voice unavailable — using the device voice.");
      }
    }

    this.route = "device";
    onError && onError(this.lastError || "Neural voice unavailable");
    return false;
  }

  stop() {
    this.browser.stop();
    this.server.stop();
  }
}

// Inference routing: browser HeadTTS → server HeadTTS → device speech.
// A failure at any stage falls through without blocking the conversation.

import { HeadTTSBrowser, headttsSupport } from "./headtts-browser.js";
import { HeadTTSServer } from "./headtts-server.js";
import { prepareForSpeech } from "./pronunciation.js";
import { readEnginePreference, writeEnginePreference } from "./voice-config.js";

const BROWSER_TIMEOUT_MS = 60000;

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
    this.browserFailed = false;
    this.pending = false;
  }

  setEngine(engine) {
    this.engine = engine === "device" ? "device" : "neural";
    writeEnginePreference(this.engine);
    this.stop();
    if (this.engine === "neural" && (headttsSupport().webgpu || headttsSupport().wasm)) {
      this.browserFailed = false;
      this.browser.prewarm().catch(() => { this.browserFailed = true; });
    }
  }

  getCapabilities() {
    return { ...headttsSupport(), signedIn: this.signedIn, engine: this.engine };
  }

  getStatus() {
    return { route: this.route, error: this.lastError, engine: this.engine };
  }

  isNeuralReady() {
    return this.browser.isReady() && !this.browserFailed;
  }

  isPending() {
    return this.pending;
  }

  async speak(text, persona, callbacks = {}) {
    const { onStatus, onError } = callbacks;
    if (this.engine === "device") {
      this.route = "device";
      return false;
    }
    const support = this.getCapabilities();
    const lowMemory = typeof navigator.deviceMemory === "number" && navigator.deviceMemory < 3;
    let browserViable = (support.webgpu || (support.wasm && !lowMemory));
    const spoken = prepareForSpeech(text);

    if (browserViable && this.browserFailed) browserViable = false;
    if (browserViable && !this.browser.isReady()) {
      this.pending = true;
      this.browser.prewarm().catch(() => { this.browserFailed = true; });
      onStatus && onStatus("Neural voice is loading in the background · using the device voice for now.");
      this.route = "device";
      return false;
    }
    this.pending = false;
    if (browserViable) {
      try {
        this.route = "browser";
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

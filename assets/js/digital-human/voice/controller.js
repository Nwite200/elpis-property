// One voice controller for recognition + synthesis. Explicit user gesture is
// required before any audio; text always remains the fallback.

import { detectVoiceSupport, voiceSupportMessage } from "./capabilities.js";
import { VoiceSynthesis } from "./synthesis.js";
import { VoiceRecognition } from "./recognition.js";

export function createVoice(persona) {
  const support = detectVoiceSupport();
  const synth = support.synthesis ? new VoiceSynthesis() : null;
  const recognition = support.recognition ? new VoiceRecognition(support) : null;
  const listeners = new Set();
  const profile = persona.voice || { lang: "en-NG", rate: 1, pitch: 1 };

  const state = {
    supported: support.recognition || support.synthesis,
    recognition: support.recognition,
    synthesis: support.synthesis,
    enabled: false,
    muted: false,
    listening: false,
    speaking: false,
    interim: "",
    status: support.recognition || support.synthesis
      ? "Voice is off — enable it to hear replies."
      : voiceSupportMessage(support),
    error: ""
  };

  if (synth) {
    synth.onStateChange = change => {
      if (typeof change.speaking === "boolean") state.speaking = change.speaking;
      if (state.speaking) state.status = "Speaking… tap Stop to interrupt.";
      else if (state.enabled) state.status = readyText();
      emit();
    };
  }

  function readyText() {
    const name = synth && synth.voiceName;
    return name
      ? `Voice ready · ${name}`
      : "Voice ready · using your device's default voice.";
  }

  function emit() {
    const snapshot = snapshotState();
    for (const listener of listeners) {
      try { listener(snapshot); } catch (_) { /* ignore */ }
    }
  }

  function snapshotState() {
    return {
      supported: state.supported,
      recognition: state.recognition,
      synthesis: state.synthesis,
      enabled: state.enabled,
      muted: state.muted,
      listening: state.listening,
      speaking: state.speaking,
      interim: state.interim,
      status: state.status,
      error: state.error,
      voiceName: synth ? synth.voiceName : "",
      lang: profile.lang
    };
  }

  function setStatus(text, error = "") {
    state.status = text;
    state.error = error;
    emit();
  }

  function cancelAudio() {
    if (synth) synth.cancel();
    state.speaking = false;
  }

  function stopListening() {
    if (recognition) recognition.abort();
    state.listening = false;
    state.interim = "";
    if (state.enabled) state.status = readyText();
    emit();
  }

  function enable({ silent = false } = {}) {
    if (!support.synthesis) {
      setStatus(voiceSupportMessage(support), "unsupported");
      return false;
    }
    state.enabled = true;
    state.muted = false;
    setStatus(readyText());
    if (!silent) {
      speak("Voice is on. I'll read my replies aloud. You can stop me at any time.", { force: true });
    }
    return true;
  }

  function disable() {
    cancelAudio();
    stopListening();
    state.enabled = false;
    state.muted = true;
    setStatus("Voice is off — enable it to hear replies.");
    return true;
  }

  function toggle() {
    return state.enabled ? disable() : enable();
  }

  function speak(text, { force = false } = {}) {
    if (!synth) return false;
    if (!force && (!state.enabled || state.muted)) return false;
    if (!force) {
      state.enabled = true;
      state.muted = false;
    }
    const started = synth.speak(text, profile, {
      onStart() {
        state.speaking = true;
        state.status = "Speaking… tap Stop to interrupt.";
        emit();
      },
      onEnd() {
        state.speaking = false;
        if (state.enabled) state.status = readyText();
        emit();
      },
      onError(reason) {
        state.speaking = false;
        state.status = reason === "synthesis-failed"
          ? "Spoken replies are not available right now — captions are shown."
          : "Speech stopped. Captions are always shown.";
        emit();
      }
    });
    if (started) {
      state.speaking = true;
      state.status = "Speaking… tap Stop to interrupt.";
      emit();
    }
    return started;
  }

  function startListening() {
    if (!recognition) {
      setStatus(voiceSupportMessage(support), "unsupported");
      return false;
    }
    cancelAudio();
    if (!state.enabled) {
      state.enabled = true;
      state.muted = false;
    }
    const started = recognition.start({
      lang: profile.lang || "en-NG",
      onStart() {
        state.listening = true;
        state.interim = "";
        state.status = "Listening… speak now.";
        emit();
      },
      onInterim(text) {
        state.interim = text;
        state.status = text ? `Hearing: “${text}”` : "Listening… speak now.";
        emit();
      },
      onFinal(text) {
        state.listening = false;
        state.interim = "";
        state.status = "Got it…";
        emit();
        if (typeof controller.onTranscript === "function") controller.onTranscript(text);
      },
      onEnd() {
        state.listening = false;
        state.interim = "";
        if (state.enabled && !state.speaking) state.status = readyText();
        emit();
      },
      onError(message, code) {
        state.listening = false;
        state.interim = "";
        setStatus(message, code);
      }
    });
    if (started) {
      state.listening = true;
      state.status = "Listening… speak now.";
      emit();
    }
    return started;
  }

  function replay() {
    const text = controller.lastAssistantText;
    if (!text) return false;
    if (!state.enabled) {
      state.enabled = true;
      state.muted = false;
    }
    return speak(text, { force: true });
  }

  function stop() {
    cancelAudio();
    stopListening();
    if (state.enabled) setStatus(readyText());
  }

  function destroy() {
    cancelAudio();
    stopListening();
    listeners.clear();
  }

  const controller = {
    support,
    state,
    subscribe(fn) {
      listeners.add(fn);
      fn(snapshotState());
      return () => listeners.delete(fn);
    },
    snapshot: snapshotState,
    enable,
    disable,
    toggle,
    speak,
    replay,
    startListening,
    stopListening,
    stop,
    destroy,
    onTranscript: null,
    lastAssistantText: ""
  };

  return controller;
}

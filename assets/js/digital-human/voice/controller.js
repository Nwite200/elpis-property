// One voice controller for recognition + synthesis. Explicit user gesture is
// required before any audio; text always remains the fallback.

import { detectVoiceSupport, voiceSupportMessage } from "./capabilities.js";
import { VoiceSynthesis } from "./synthesis.js";
import { VoiceRecognition } from "./recognition.js";
import { VoiceRecorder } from "./recorder.js";
import { VoiceSelector } from "./selector.js";
import { kokoroVoiceFor, KOKORO_VOICE_LABELS } from "./voice-config.js";

export function createVoice(persona, context) {
  const support = detectVoiceSupport();
  const synth = support.synthesis ? new VoiceSynthesis() : null;
  const recognition = support.recognition ? new VoiceRecognition(support) : null;
  const recorder = new VoiceRecorder();
  const selector = new VoiceSelector({ signedIn: !!(context && context.signedIn) });
  const listeners = new Set();
  let currentPersona = persona;
  let profile = persona.voice || { lang: "en-NG", rate: 1, pitch: 1 };
  let speechToken = 0;
  let neuralFailed = false;

  const state = {
    supported: support.recognition || support.synthesis || recorder.supported,
    recognition: support.recognition,
    synthesis: support.synthesis,
    recorder: recorder.supported,
    enabled: false,
    muted: false,
    listening: false,
    recording: false,
    speaking: false,
    interim: "",
    status: support.recognition || support.synthesis || recorder.supported
      ? "Voice is off — enable it to hear replies."
      : voiceSupportMessage(support),
    error: "",
    engine: selector.engine,
    route: "device",
    viseme: "sil"
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
    if (selector.engine === "neural") {
      if (neuralFailed) return "Neural voice unavailable · using the device voice.";
      const voice = kokoroVoiceFor(currentPersona.key);
      return `Neural voice ready · ${KOKORO_VOICE_LABELS[voice] || voice}`;
    }
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
      recorder: state.recorder,
      enabled: state.enabled,
      muted: state.muted,
      listening: state.listening,
      recording: state.recording,
      speaking: state.speaking,
      engine: selector.engine,
      route: selector.route,
      viseme: state.viseme,
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
    speechToken += 1;
    selector.stop();
    if (synth) synth.cancel();
    state.speaking = false;
    state.viseme = "sil";
    if (typeof controller.onViseme === "function") controller.onViseme("sil");
  }

  function stopListening() {
    if (recognition) recognition.abort();
    if (recorder.active) recorder.cancel();
    state.listening = false;
    state.recording = false;
    state.interim = "";
    if (state.enabled) state.status = readyText();
    emit();
  }

  function enable({ silent = false } = {}) {
    state.error = "";
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

  function speakNative(text, token) {
    const started = synth.speak(text, profile, {
      onStart() {
        if (token !== speechToken) return;
        state.speaking = true;
        state.route = "device";
        state.status = "Speaking… tap Stop to interrupt.";
        emit();
      },
      onEnd() {
        if (token !== speechToken) return;
        state.speaking = false;
        state.viseme = "sil";
        if (state.enabled) state.status = readyText();
        emit();
      },
      onError(reason) {
        if (token !== speechToken) return;
        state.speaking = false;
        state.viseme = "sil";
        state.status = reason === "blocked"
          ? "Your browser blocked spoken replies. Captions are always shown — tap Replay to try again."
          : reason === "synthesis-failed"
            ? "Spoken replies are not available right now — captions are shown."
            : "Speech stopped. Captions are always shown.";
        emit();
      }
    });
    if (started) {
      state.speaking = true;
      state.route = "device";
      state.status = "Speaking… tap Stop to interrupt.";
      emit();
    }
    return started;
  }

  function speak(text, { force = false } = {}) {
    if (!force && (!state.enabled || state.muted)) return false;
    if (!force) {
      state.enabled = true;
      state.muted = false;
    }
    const token = ++speechToken;
    if (selector.engine === "neural") {
      state.speaking = true;
      state.status = "Preparing neural voice…";
      emit();
      selector.speak(text, currentPersona, {
        onStatus(message) {
          if (token !== speechToken) return;
          state.status = message;
          emit();
        },
        onStart() {
          if (token !== speechToken) return;
          neuralFailed = false;
          state.speaking = true;
          state.route = selector.route;
          state.status = "Speaking… tap Stop to interrupt.";
          emit();
        },
        onViseme(viseme) {
          if (token !== speechToken) return;
          state.viseme = viseme || "sil";
          if (typeof controller.onViseme === "function") controller.onViseme(state.viseme);
          emit();
        },
        onEnd() {
          if (token !== speechToken) return;
          state.speaking = false;
          state.viseme = "sil";
          if (typeof controller.onViseme === "function") controller.onViseme("sil");
          if (state.enabled) state.status = readyText();
          emit();
        }
      }).then(handled => {
        if (token !== speechToken) return;
        if (!handled) {
          neuralFailed = true;
          if (synth) speakNative(text, token);
          else {
            state.speaking = false;
            state.status = "Neural voice unavailable and no device voice is installed. Captions are shown.";
            emit();
          }
        }
      }).catch(() => {
        if (token !== speechToken) return;
        if (synth) speakNative(text, token);
      });
      return true;
    }
    if (!synth) return false;
    return speakNative(text, token);
  }

  function setEngine(engine) {
    selector.setEngine(engine);
    neuralFailed = false;
    state.engine = selector.engine;
    state.speaking = false;
    if (state.enabled) state.status = readyText();
    emit();
    return selector.engine;
  }

  async function beginRecording() {
    if (!state.enabled) {
      state.enabled = true;
      state.muted = false;
    }
    cancelAudio();
    state.recording = true;
    state.listening = true;
    state.error = "";
    state.status = "Listening… speak, then tap the mic to stop.";
    emit();
    let text = "";
    try {
      text = await recorder.start({
        onAutoStop() {
          state.status = "Transcribing…";
          state.recording = false;
          emit();
        }
      });
    } catch (error) {
      state.recording = false;
      state.listening = false;
      const code = error && error.code;
      const message = code === "unsupported"
        ? "Voice recording is not supported in this browser. Please type instead."
        : error && error.name === "NotAllowedError"
          ? "Microphone permission was blocked. Allow it in your browser settings, or type instead."
          : error && error.name === "NotFoundError"
            ? "No microphone was found. You can still type."
            : code === "rate"
              ? (error.message || "Too many voice attempts. Please wait a few minutes.")
              : "I could not transcribe that. Please try again or type.";
      setStatus(message, code || "recording");
      return;
    }
    state.recording = false;
    state.listening = false;
    if (recorder.cancelled) { if (state.enabled) state.status = readyText(); emit(); return; }
    if (!text) {
      setStatus("I didn't catch that. Try again, or type your message.", "no-speech");
      return;
    }
    state.status = "Got it…";
    emit();
    if (typeof controller.onTranscript === "function") controller.onTranscript(text);
  }

  function finishRecording() {
    state.status = "Transcribing…";
    emit();
    recorder.stop();
  }

  function startListening() {
    if (recorder.supported) {
      if (state.recording) { finishRecording(); return true; }
      beginRecording();
      return true;
    }
    if (!recognition) {
      setStatus(voiceSupportMessage(support), "unsupported");
      return false;
    }
    cancelAudio();
    if (!state.enabled) {
      state.enabled = true;
      state.muted = false;
    }
    state.status = "Requesting microphone…";
    state.error = "";
    emit();
    const started = recognition.start({
      lang: profile.lang || "en-NG",
      onStart() {
        state.listening = true;
        state.interim = "";
        state.error = "";
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
        state.error = "";
        state.status = "Got it…";
        emit();
        if (typeof controller.onTranscript === "function") controller.onTranscript(text);
      },
      onEnd() {
        state.listening = false;
        state.interim = "";
        if (state.enabled && !state.speaking && !state.error) state.status = readyText();
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

  function toggleListening() {
    if (state.recording) { finishRecording(); return true; }
    if (state.listening) {
      if (recognition) recognition.stop();
      return true;
    }
    return startListening();
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

  function setPersona(nextPersona) {
    if (!nextPersona) return;
    currentPersona = nextPersona;
    profile = nextPersona.voice || profile;
    neuralFailed = false;
    cancelAudio();
    if (synth) synth.voiceName = "";
    state.interim = "";
    if (state.enabled) state.status = readyText();
    emit();
  }

  function voices() {
    if (!synth) return [];
    return (synth.voices || []).map(voice => ({ name: voice.name, lang: voice.lang, local: !!voice.localService }));
  }

  function setVoice(name) {
    if (!synth) return false;
    selector.setEngine("device");
    state.engine = "device";
    synth.setPreferredVoice(name);
    synth.voiceName = name || "";
    if (state.enabled) state.status = readyText();
    emit();
    if (name) speak("This is how I will sound.", { force: true });
    return true;
  }

  function destroy() {
    cancelAudio();
    stopListening();
    if (recorder) recorder.destroy();
    selector.stop();
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
    toggleListening,
    stopListening,
    stop,
    setPersona,
    voices,
    setVoice,
    setEngine,
    destroy,
    onTranscript: null,
    lastAssistantText: ""
  };

  return controller;
}

// Browser capability detection for the free voice engine.
// Everything is feature-detected; nothing is assumed.

export function detectVoiceSupport() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const synthesis = window.speechSynthesis || null;
  const Utterance = window.SpeechSynthesisUtterance || null;
  return {
    recognition: typeof Recognition === "function",
    synthesis: !!(synthesis && typeof synthesis.speak === "function" && typeof Utterance === "function"),
    secure: window.isSecureContext !== false,
    Recognition,
    synthesis,
    Utterance
  };
}

export function voiceSupportMessage(support) {
  if (support.recognition && support.synthesis) return "";
  if (!support.recognition && !support.synthesis) {
    return "Voice is not supported in this browser — please type instead.";
  }
  if (!support.recognition) {
    return "Speech input is not supported here — you can still type, or enable spoken replies.";
  }
  return "Spoken replies are not supported here — you can still type or speak.";
}

// Elpis Property digital human — bootstrap (Phase 2).
// One deferred module mounts the assistant on every page; nothing is
// privileged, every link and future tool stays inside the existing app.

import { ENABLED, VERSION, PERSONAS, personaByKey } from "./config.js";
import { getContext } from "./context.js";
import { Conversation } from "./conversation.js";
import { AssistantUI } from "./ui.js";
import { createVoice } from "./voice/controller.js";

const CSS_URL = new URL("../../css/digital-human.css", import.meta.url).href;

function disabledByUser() {
  if (document.documentElement.dataset.elpDh === "off") return true;
  try {
    if (new URLSearchParams(window.location.search).get("assistant") === "0") return true;
    return sessionStorage.getItem("elp-dh-hidden") === "1";
  } catch (_) {
    return false;
  }
}

function loadStyles() {
  if (document.getElementById("elp-dh-styles")) return Promise.resolve();
  return new Promise(resolve => {
    const link = document.createElement("link");
    link.id = "elp-dh-styles";
    link.rel = "stylesheet";
    link.href = CSS_URL;
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    document.head.appendChild(link);
    setTimeout(resolve, 1800);
  });
}

function whenIdle(fn) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(fn, { timeout: 2200 });
  } else {
    window.setTimeout(fn, 900);
  }
}

async function mount() {
  if (!ENABLED || disabledByUser() || window.ElpAssistant) return;
  if (!document.body || document.body.dataset.assistant === "off") return;
  if (document.title === "Offline | Elpis Property Limited") return;

  await loadStyles();
  const context = await getContext();
  const persona = personaByKey("adaora");
  const conversation = new Conversation(context, persona);
  const voice = createVoice(persona);

  const ui = new AssistantUI({
    persona,
    conversation,
    voice,
    mounted: true,
    onSend(text) {
      return conversation.handle(text);
    },
    onReset() {
      return conversation.reset();
    }
  });

  const onKeydown = event => ui.onKeydown(event);
  document.addEventListener("keydown", onKeydown);

  window.ElpAssistant = {
    version: VERSION,
    persona: persona.key,
    personas: PERSONAS.map(p => ({ key: p.key, name: p.name, department: p.department, available: p.available })),
    context,
    open: () => ui.show(),
    close: () => ui.close(),
    toggle: () => ui.toggle(),
    send: text => ui.submit(text),
    reset: () => ui.reset(),
    state: () => (ui.open ? "open" : "closed"),
    voice,
    voiceSnapshot: () => voice.snapshot(),
    hide: () => {
      try { sessionStorage.setItem("elp-dh-hidden", "1"); } catch (_) { /* ignore */ }
      document.removeEventListener("keydown", onKeydown);
      ui.close();
      ui.destroy();
      delete window.ElpAssistant;
    }
  };

  document.dispatchEvent(new CustomEvent("elp-dh:ready", {
    detail: { version: VERSION, persona: persona.key }
  }));
}

whenIdle(() => {
  mount().catch(error => {
    // The assistant must never break the host application.
    console.warn("Elpis assistant failed to mount", error);
  });
});

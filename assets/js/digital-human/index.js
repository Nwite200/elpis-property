// Elpis Property digital human — bootstrap (Phase 2).
// One deferred module mounts the assistant on every page; nothing is
// privileged, every link and future tool stays inside the existing app.

import { ENABLED, VERSION, PERSONAS, personaByKey } from "./config.js";
import { getContext, introTextFor } from "./context.js";
import { Conversation } from "./conversation.js";
import { AssistantUI } from "./ui.js";
import { createVoice } from "./voice/controller.js";
import { createPaymentWatcher } from "./tools/payments.js";
import { checkHandover, requestHandover } from "./tools/handover.js";

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
    onLanguage() { savePreferences(); },
    onVoicePreference() { savePreferences(); },
    onHandover(action) {
      requestHandover(context, action).then(reply => {
        ui.notifyAssistant(reply.text, reply.actions);
        if (reply.handoverId) startHandoverPolling(reply.handoverId);
      });
    },
    onSend(text) {
      return conversation.handle(text);
    },
    onReset() {
      return conversation.reset();
    }
  });

  const onKeydown = event => ui.onKeydown(event);
  document.addEventListener("keydown", onKeydown);

  const paymentWatcher = context.signedIn
    ? createPaymentWatcher(context, (event) => ui.notifyPayment(event.text, event.actions))
    : null;
  if (paymentWatcher) paymentWatcher.start();

  let handoverTimer = null;
  let handoverId = null;
  function stopHandoverPolling() {
    if (handoverTimer) { window.clearInterval(handoverTimer); handoverTimer = null; }
    handoverId = null;
  }
  async function handleHandoverStatus(id) {
    const handover = await checkHandover(id);
    if (!handover || handoverId !== id) return;
    if (handover.status === "accepted") {
      stopHandoverPolling();
      ui.notifyAssistant(
        `${handover.staff_name} accepted your handover request. The transfer is now active; they will continue with you using your registered details.`,
        context.isClient ? [{ label: "Contact details", href: "index.html#contact" }] : [{ label: "Open staff chat", href: "staff-chat.html" }]
      );
    } else if (handover.status === "declined") {
      stopHandoverPolling();
      ui.notifyAssistant(
        `${handover.staff_name} could not take the handover. You can choose another team member or contact the team directly.`,
        [{ label: "Contact the team", href: "index.html#contact" }]
      );
    }
  }

  function startHandoverPolling(id) {
    stopHandoverPolling();
    handoverId = id;
    handleHandoverStatus(id).catch(() => {});
    let attempts = 0;
    handoverTimer = window.setInterval(async () => {
      attempts += 1;
      if (attempts > 16 || handoverId !== id) { stopHandoverPolling(); return; }
      await handleHandoverStatus(id).catch(() => {});
    }, 8000);
  }

  let presenceTimer = null;
  function sendHeartbeat() {
    fetch("/api/assistant/heartbeat", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "available" })
    }).catch(() => {});
  }
  if (context.isStaff) {
    sendHeartbeat();
    presenceTimer = window.setInterval(() => { if (!document.hidden) sendHeartbeat(); }, 60000);
  }

  const isHome = context.kind === "home";
  const isDashboard = context.kind === "dashboard" || /dashboard\.html$/.test(context.page);
  const introKey = isHome ? "elp-dh-intro-home" : "elp-dh-intro-dashboard";
  let introSeen = false;
  try { introSeen = sessionStorage.getItem(introKey) === "1"; } catch (_) { /* ignore */ }
  if ((isHome || isDashboard) && !introSeen) {
    const intro = introTextFor(context);
    window.setTimeout(() => ui.showIntro(intro), 900);
    try { sessionStorage.setItem(introKey, "1"); } catch (_) { /* ignore */ }
  }

  window.ElpAssistant = {
    version: VERSION,
    get persona() { return ui.persona.key; },
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
    setLanguage: mode => conversation.setLanguage(mode),
    payments: paymentWatcher
      ? { checkNow: () => paymentWatcher.checkNow(), baseline: () => paymentWatcher.baseline(), stop: () => paymentWatcher.stop() }
      : null,
    handover: {
      request: (staffId, staffName) => requestHandover(context, { staffId, staffName }),
      check: id => checkHandover(id),
      stop: () => stopHandoverPolling()
    },
    hide: () => {
      try { sessionStorage.setItem("elp-dh-hidden", "1"); } catch (_) { /* ignore */ }
      document.removeEventListener("keydown", onKeydown);
      if (paymentWatcher) paymentWatcher.stop();
      stopHandoverPolling();
      if (presenceTimer) { window.clearInterval(presenceTimer); presenceTimer = null; }
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

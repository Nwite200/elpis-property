// Assistant shell: launcher, panel, transcript, captions and responsive states.

import { COMPANY, VERSION, PERSONAS, personaByKey } from "./config.js";
import { checkForm, hasVisibleForm, watchFormAttempts } from "./tools/forms.js";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeHref(href) {
  const value = String(href || "").trim();
  if (!value) return "#";
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(value)) return value;
  if (/^[a-z0-9][a-z0-9._/-]*$/i.test(value) && !value.startsWith("//")) return value;
  return "#";
}

function isExternal(href) {
  return /^https?:/i.test(String(href || ""));
}

function monogram(persona) {
  return el("span", "elp-dh-monogram", persona.initials || persona.name.slice(0, 1));
}

function avatar(persona, className) {
  const wrap = el("span", className || "elp-dh-avatar");
  wrap.setAttribute("aria-hidden", "true");
  const img = document.createElement("img");
  img.alt = "";
  img.decoding = "async";
  img.loading = "lazy";
  img.src = persona.avatar;
  img.addEventListener("error", () => {
    img.remove();
    wrap.classList.add("is-fallback");
    wrap.appendChild(monogram(persona));
  });
  wrap.appendChild(img);
  return wrap;
}

function actionLink(action, onAction) {
  if (action && action.action) {
    const button = el("button", "elp-dh-action", action.label);
    button.type = "button";
    button.addEventListener("click", () => onAction && onAction(action));
    return button;
  }
  const link = el("a", "elp-dh-action", action.label);
  link.href = safeHref(action.href);
  if (isExternal(action.href) || action.external) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  if (link.getAttribute("href") === "#" && !String(action.href || "").startsWith("#")) {
    link.setAttribute("aria-disabled", "true");
  }
  return link;
}

export class AssistantUI {
  constructor({ persona, conversation, onSend, onReset, mounted, voice, onHandover }) {
    this.persona = persona;
    this.conversation = conversation;
    this.onSend = onSend;
    this.onReset = onReset;
    this.mounted = mounted;
    this.voice = voice || null;
    this.onHandover = onHandover || null;
    this.handleAction = action => {
      if (action && action.action === "handover" && this.onHandover) {
        this.onHandover(action);
      }
    };
    this.lastAssistantText = "";
    this.open = false;
    this.root = el("div", "elp-dh");
    this.root.id = "elp-dh-root";
    this.root.dataset.state = "closed";
    this.root.dataset.version = VERSION;
    this.build();
    document.body.appendChild(this.root);
    this.applyFixedOffset();
    window.addEventListener("resize", () => this.applyFixedOffset(), { passive: true });
  }

  build() {
    const launcher = el("button", "elp-dh-launcher");
    launcher.type = "button";
    launcher.setAttribute("aria-label", `Open assistant, ${this.persona.name}, ${this.persona.department}`);
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-controls", "elp-dh-panel");
    this.launcherAvatar = avatar(this.persona, "elp-dh-launcher__avatar");
    launcher.appendChild(this.launcherAvatar);
    launcher.appendChild(el("span", "elp-dh-launcher__ring"));
    launcher.appendChild(el("span", "elp-dh-launcher__dot"));
    launcher.addEventListener("click", () => this.toggle());
    this.launcher = launcher;

    const panel = el("section", "elp-dh-panel");
    panel.id = "elp-dh-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "elp-dh-title");
    panel.hidden = true;

    const header = el("header", "elp-dh-header");
    this.headerAvatar = avatar(this.persona, "elp-dh-header__avatar");
    header.appendChild(this.headerAvatar);
    const identity = el("div", "elp-dh-identity");
    const title = el("h2", "elp-dh-title", this.persona.name);
    title.id = "elp-dh-title";
    identity.appendChild(title);
    const department = el("p", "elp-dh-department", `${this.persona.department} · Digital assistant`);
    identity.appendChild(department);
    header.appendChild(identity);
    this.titleNode = title;
    this.departmentNode = department;

    const status = el("span", "elp-dh-status");
    status.appendChild(el("span", "elp-dh-status__dot"));
    status.appendChild(el("span", "elp-dh-status__text", "Online"));
    header.appendChild(status);

    const tools = el("div", "elp-dh-header__tools");
    const reset = el("button", "elp-dh-icon", "↺");
    reset.type = "button";
    reset.title = "Start a new conversation";
    reset.setAttribute("aria-label", "Start a new conversation");
    reset.addEventListener("click", () => this.reset());
    tools.appendChild(reset);
    const close = el("button", "elp-dh-icon", "✕");
    close.type = "button";
    close.title = "Close assistant";
    close.setAttribute("aria-label", "Close assistant");
    close.addEventListener("click", () => this.close());
    tools.appendChild(close);
    header.appendChild(tools);
    this.closeButton = close;
    panel.appendChild(header);

    const transcript = el("div", "elp-dh-transcript");
    transcript.id = "elp-dh-transcript";
    transcript.setAttribute("role", "log");
    transcript.setAttribute("aria-live", "polite");
    transcript.setAttribute("aria-relevant", "additions");
    transcript.tabIndex = 0;
    panel.appendChild(transcript);
    this.transcript = transcript;

    const form = el("form", "elp-dh-composer");
    const label = el("label", "elp-dh-sr", "Type your message");
    label.htmlFor = "elp-dh-input";
    const input = document.createElement("input");
    input.id = "elp-dh-input";
    input.className = "elp-dh-input";
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = "Type your message…";
    input.maxLength = 500;
    const formCheck = el("button", "elp-dh-formcheck", "✓");
    formCheck.type = "button";
    formCheck.setAttribute("aria-label", "Check this form");
    formCheck.title = "Check this form";
    formCheck.hidden = !hasVisibleForm();
    formCheck.addEventListener("click", () => this.checkCurrentForm());

    const mic = el("button", "elp-dh-mic", "🎙");
    mic.type = "button";
    mic.setAttribute("aria-label", "Speak your message");
    mic.title = "Speak your message";
    mic.addEventListener("click", () => this.toggleListening());
    const send = el("button", "elp-dh-send", "Send");
    send.type = "submit";
    form.appendChild(label);
    form.appendChild(formCheck);
    form.appendChild(mic);
    form.appendChild(input);
    form.appendChild(send);
    form.addEventListener("submit", event => {
      event.preventDefault();
      const value = input.value;
      input.value = "";
      this.submit(value);
    });
    panel.appendChild(form);
    this.input = input;
    this.sendButton = send;
    this.micButton = mic;
    this.formCheckButton = formCheck;

    const footer = el("footer", "elp-dh-footer");
    const voiceBar = el("div", "elp-dh-voicebar");
    const speaker = el("button", "elp-dh-voice-btn", "🔊 Voice off");
    speaker.type = "button";
    speaker.setAttribute("aria-pressed", "false");
    speaker.title = "Turn spoken replies on or off";
    speaker.addEventListener("click", () => this.toggleVoice());
    const voiceSelect = document.createElement("select");
    voiceSelect.className = "elp-dh-voice-select";
    voiceSelect.setAttribute("aria-label", "Choose a voice");
    voiceSelect.hidden = true;
    voiceSelect.addEventListener("change", () => {
      if (this.voice) this.voice.setVoice(voiceSelect.value);
    });
    const replay = el("button", "elp-dh-voice-btn", "↻ Replay");
    replay.type = "button";
    replay.hidden = true;
    replay.addEventListener("click", () => this.replay());
    const stop = el("button", "elp-dh-voice-btn", "■ Stop");
    stop.type = "button";
    stop.hidden = true;
    stop.addEventListener("click", () => this.stopVoice());
    voiceBar.appendChild(speaker);
    voiceBar.appendChild(voiceSelect);
    voiceBar.appendChild(replay);
    voiceBar.appendChild(stop);
    const voiceStatus = el("span", "elp-dh-voice-status", "Voice is off");
    voiceStatus.id = "elp-dh-voice-status";
    voiceStatus.setAttribute("role", "status");
    voiceStatus.setAttribute("aria-live", "polite");
    footer.appendChild(voiceBar);
    footer.appendChild(voiceStatus);
    this.footer = footer;
    this.speakerButton = speaker;
    this.voiceSelect = voiceSelect;
    this.replayButton = replay;
    this.stopButton = stop;
    this.voiceStatus = voiceStatus;
    panel.appendChild(footer);

    this.stopFormWatch = watchFormAttempts(issue => this.showFormGuidance(issue));

    if (this.voice) {
      if (!this.voice.state.recognition) mic.hidden = true;
      if (!this.voice.state.synthesis) {
        speaker.hidden = true;
        replay.hidden = true;
        stop.hidden = true;
      }
      this.voice.onTranscript = text => this.submit(text, { fromVoice: true });
      this.unsubscribeVoice = this.voice.subscribe(snapshot => this.syncVoice(snapshot));
      window.setTimeout(() => this.populateVoiceOptions(), 700);
      if (window.speechSynthesis && typeof window.speechSynthesis.addEventListener === "function") {
        this.onVoicesChanged = () => this.populateVoiceOptions();
        window.speechSynthesis.addEventListener("voiceschanged", this.onVoicesChanged);
      }
    } else {
      mic.hidden = true;
      speaker.hidden = true;
      voiceBar.hidden = true;
      status.textContent = "Voice is unavailable. You can type your message.";
    }

    this.panel = panel;
    this.root.appendChild(panel);
    this.root.appendChild(launcher);
    this.render();
  }

  applyFixedOffset() {
    if (window.innerWidth > 640) {
      this.root.style.removeProperty("--elp-dh-offset");
      return;
    }
    const nav = document.querySelector(".mobile-nav, .mobile-bottom-nav, .bottom-nav, .client-bottom-nav");
    if (nav && getComputedStyle(nav).position === "fixed") {
      this.root.style.setProperty("--elp-dh-offset", `${Math.round(nav.getBoundingClientRect().height) + 20}px`);
    } else {
      this.root.style.removeProperty("--elp-dh-offset");
    }
  }

  render() {
    const transcript = this.transcript;
    transcript.textContent = "";
    for (const message of this.conversation.messages) {
      const row = el("div", `elp-dh-msg elp-dh-msg--${message.role}`);
      row.appendChild(el("div", "elp-dh-bubble", message.text));
      if (Array.isArray(message.actions) && message.actions.length) {
        const actions = el("div", "elp-dh-actions");
        for (const action of message.actions) actions.appendChild(actionLink(action, this.handleAction));
        row.appendChild(actions);
      }
      transcript.appendChild(row);
      if (message.role === "assistant" && message.text) this.lastAssistantText = message.text;
    }
    if (this.voice) this.voice.lastAssistantText = this.lastAssistantText;
    transcript.scrollTop = transcript.scrollHeight;
  }

  append(message) {
    const row = el("div", `elp-dh-msg elp-dh-msg--${message.role}`);
    row.appendChild(el("div", "elp-dh-bubble", message.text));
    if (Array.isArray(message.actions) && message.actions.length) {
      const actions = el("div", "elp-dh-actions");
      for (const action of message.actions) actions.appendChild(actionLink(action, this.handleAction));
      row.appendChild(actions);
    }
    this.transcript.appendChild(row);
    this.transcript.scrollTop = this.transcript.scrollHeight;
    return row;
  }

  thinking(on) {
    if (on) {
      if (this.typing) return;
      const row = el("div", "elp-dh-msg elp-dh-msg--assistant elp-dh-typing");
      row.setAttribute("aria-label", `${this.persona.name} is thinking`);
      for (let i = 0; i < 3; i++) row.appendChild(el("span", "elp-dh-typing__dot"));
      this.transcript.appendChild(row);
      this.typing = row;
      this.transcript.scrollTop = this.transcript.scrollHeight;
      this.root.dataset.thinking = "true";
    } else if (this.typing) {
      this.typing.remove();
      this.typing = null;
      this.root.dataset.thinking = "false";
    }
  }

  populateVoiceOptions() {
    if (!this.voiceSelect || !this.voice) return;
    const voices = this.voice.voices();
    if (voices.length < 2) { this.voiceSelect.hidden = true; return; }
    let preferred = "";
    try { preferred = localStorage.getItem("elp-dh-voice-preference") || ""; } catch (_) { preferred = ""; }
    this.voiceSelect.textContent = "";
    const auto = document.createElement("option");
    auto.value = "";
    auto.textContent = "Voice · auto (best available)";
    this.voiceSelect.appendChild(auto);
    for (const voice of voices.slice(0, 40)) {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `${voice.name} · ${voice.lang}`;
      this.voiceSelect.appendChild(option);
    }
    this.voiceSelect.value = voices.some(v => v.name === preferred) ? preferred : "";
    this.voiceSelect.hidden = false;
  }

  syncVoice(snapshot) {
    if (!snapshot) return;
    this.root.dataset.voice = snapshot.enabled && !snapshot.muted ? "on" : "off";
    this.root.dataset.listening = snapshot.listening ? "true" : "false";
    this.root.dataset.speaking = snapshot.speaking ? "true" : "false";
    if (this.micButton) {
      this.micButton.classList.toggle("is-listening", !!snapshot.listening);
      this.micButton.setAttribute("aria-pressed", String(!!snapshot.listening));
      this.micButton.setAttribute("aria-label", snapshot.listening ? "Stop listening" : "Speak your message");
    }
    if (this.speakerButton && !this.speakerButton.hidden) {
      const on = snapshot.enabled && !snapshot.muted;
      this.speakerButton.textContent = on ? "🔊 Voice on" : "🔇 Voice off";
      this.speakerButton.setAttribute("aria-pressed", String(on));
    }
    if (this.replayButton) this.replayButton.hidden = !this.lastAssistantText;
    if (this.stopButton) this.stopButton.hidden = !(snapshot.speaking || snapshot.listening);
    if (this.voiceStatus) {
      this.voiceStatus.textContent = snapshot.status || "";
      this.voiceStatus.dataset.error = snapshot.error ? "true" : "false";
    }
  }

  toggleVoice() {
    if (!this.voice) return;
    this.voice.toggle();
  }

  toggleListening() {
    if (!this.voice) return;
    if (this.voice.state.listening) this.voice.stopListening();
    else this.voice.startListening();
  }

  replay() {
    if (this.voice) this.voice.replay();
  }

  stopVoice() {
    if (this.voice) this.voice.stop();
  }

  showIntro(text) {
    if (this.introBubble || this.open) return;
    const bubble = el("div", "elp-dh-intro");
    bubble.setAttribute("role", "status");
    bubble.appendChild(el("p", "elp-dh-intro__text", text));
    const actions = el("div", "elp-dh-intro__actions");
    const open = el("button", "elp-dh-intro__open", `Talk to ${this.persona.name}`);
    open.type = "button";
    open.addEventListener("click", () => {
      this.removeIntro();
      this.show();
    });
    actions.appendChild(open);
    if (this.voice && this.voice.state.synthesis) {
      const hear = el("button", "elp-dh-intro__hear", "🔊 Hear greeting");
      hear.type = "button";
      hear.addEventListener("click", () => {
        this.removeIntro();
        this.voice.enable({ silent: true });
        this.voice.speak(text, { force: true });
        this.show();
      });
      actions.appendChild(hear);
    }
    bubble.appendChild(actions);
    const close = el("button", "elp-dh-intro__close", "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss introduction");
    close.addEventListener("click", () => this.removeIntro());
    bubble.appendChild(close);
    this.root.insertBefore(bubble, this.launcher);
    this.introBubble = bubble;
    this.introTimer = window.setTimeout(() => this.removeIntro(), 16000);
  }

  removeIntro() {
    if (this.introTimer) { window.clearTimeout(this.introTimer); this.introTimer = null; }
    if (this.introBubble) { this.introBubble.remove(); this.introBubble = null; }
  }

  updateIdentity() {
    const header = avatar(this.persona, "elp-dh-header__avatar");
    const launcher = avatar(this.persona, "elp-dh-launcher__avatar");
    if (this.headerAvatar) this.headerAvatar.replaceWith(header);
    if (this.launcherAvatar) this.launcherAvatar.replaceWith(launcher);
    this.headerAvatar = header;
    this.launcherAvatar = launcher;
    if (this.titleNode) this.titleNode.textContent = this.persona.name;
    if (this.departmentNode) this.departmentNode.textContent = `${this.persona.department} · Digital assistant`;
    this.launcher.setAttribute("aria-label", `Open assistant, ${this.persona.name}, ${this.persona.department}`);
    this.root.dataset.persona = this.persona.key;
  }

  switchPersona({ key, greeting, reply }) {
    const next = personaByKey(key);
    if (!next || !next.available) return false;
    if (next.key === this.persona.key) {
      if (reply) {
        this.conversation.push("assistant", reply.text, reply.actions);
        this.append({ role: "assistant", text: reply.text, actions: reply.actions });
        this.lastAssistantText = reply.text;
        if (this.voice) this.voice.lastAssistantText = reply.text;
        if (this.voice) this.voice.speak(reply.text);
      }
      return true;
    }
    this.switching = true;
    this.root.classList.add("is-switching");
    if (this.voice) this.voice.stop();
    window.setTimeout(() => {
      this.persona = next;
      this.conversation.setPersona(next);
      if (this.voice) this.voice.setPersona(next);
      this.updateIdentity();
      this.root.classList.remove("is-switching");
      if (greeting) {
        this.conversation.push("assistant", greeting, []);
        this.append({ role: "assistant", text: greeting, actions: [] });
        this.lastAssistantText = greeting;
        if (this.voice) this.voice.lastAssistantText = greeting;
      }
      if (reply) {
        this.conversation.push("assistant", reply.text, reply.actions);
        this.append({ role: "assistant", text: reply.text, actions: reply.actions });
        this.lastAssistantText = reply.text;
        if (this.voice) {
          this.voice.lastAssistantText = reply.text;
          this.voice.speak(`${greeting ? greeting + " " : ""}${reply.text}`);
        }
      } else if (greeting && this.voice) {
        this.voice.speak(greeting);
      }
      this.switching = false;
      this.syncVoice(this.voice ? this.voice.snapshot() : null);
      if (this.open) this.input.focus();
      document.dispatchEvent(new CustomEvent("elp-dh:persona", { detail: { persona: next.key } }));
    }, 300);
    return true;
  }

  showFormGuidance(text) {
    if (!text) return;
    const last = this.conversation.messages[this.conversation.messages.length - 1];
    if (last && last.role === "assistant" && last.text === text) return;
    if (!this.open) {
      this.removeIntro();
      this.showIntro(text);
      return;
    }
    this.conversation.push("assistant", text, []);
    this.append({ role: "assistant", text, actions: [] });
    this.lastAssistantText = text;
    if (this.voice) {
      this.voice.lastAssistantText = text;
      this.voice.speak(text);
    }
  }

  checkCurrentForm() {
    if (!this.open) this.show();
    const result = checkForm();
    this.showFormGuidance(result.text);
    if (this.voiceStatus) this.syncVoice(this.voice ? this.voice.snapshot() : null);
  }

  notifyAssistant(text, actions = []) {
    if (!text) return;
    const last = this.conversation.messages[this.conversation.messages.length - 1];
    if (last && last.role === "assistant" && last.text === text) return;
    this.conversation.push("assistant", text, actions);
    this.lastAssistantText = text;
    if (this.voice) this.voice.lastAssistantText = text;
    if (this.open) {
      this.append({ role: "assistant", text, actions });
      if (this.voice) this.voice.speak(text);
    } else {
      this.removeIntro();
      this.showIntro(text);
    }
  }

  notifyPayment(text, actions = []) {
    this.notifyAssistant(text, actions);
  }

  submit(text, { fromVoice = false } = {}) {
    const value = String(text || "").trim();
    if (!value || this.switching) return;
    if (this.voice) {
      this.voice.stopListening();
      this.voice.stop();
    }
    this.append({ role: "user", text: value });
    this.thinking(true);
    this.sendButton.disabled = true;
    window.setTimeout(async () => {
      let reply = null;
      try {
        reply = await this.onSend(value);
      } catch (_) {
        reply = { text: "I could not reach that workspace just now. The pages still work — please try again.", actions: [] };
      }
      this.thinking(false);
      this.sendButton.disabled = false;
      this.lastAssistantText = reply ? reply.text : "";
      if (this.voice) this.voice.lastAssistantText = this.lastAssistantText;
      this.append({
        role: "assistant",
        text: reply ? reply.text : "I'm here.",
        actions: reply ? reply.actions : []
      });
      if (reply && reply.handover) {
        this.sendButton.disabled = true;
        this.syncVoice(this.voice ? this.voice.snapshot() : null);
        window.setTimeout(() => {
          this.sendButton.disabled = false;
          this.switchPersona(reply.handover);
        }, 950);
        return;
      }
      if (this.voice && reply && reply.text) this.voice.speak(reply.text);
      this.syncVoice(this.voice ? this.voice.snapshot() : null);
      if (!fromVoice) this.input.focus();
    }, 360);
  }

  reset() {
    if (this.voice) this.voice.stop();
    this.lastAssistantText = "";
    if (this.voice) this.voice.lastAssistantText = "";
    this.switching = false;
    const adaora = personaByKey("adaora");
    this.persona = adaora;
    this.conversation.setPersona(adaora);
    if (this.voice) this.voice.setPersona(adaora);
    this.updateIdentity();
    const messages = this.onReset();
    this.render(messages);
    this.syncVoice(this.voice ? this.voice.snapshot() : null);
    this.input.focus();
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  preloadPortraits() {
    if (this.portraitsPreloaded) return;
    this.portraitsPreloaded = true;
    for (const persona of PERSONAS) {
      if (!persona.avatar) continue;
      const image = new Image();
      image.decoding = "async";
      image.src = persona.avatar;
    }
  }

  show() {
    this.removeIntro();
    this.preloadPortraits();
    if (this.open) return;
    this.open = true;
    this.panel.hidden = false;
    this.root.dataset.state = "open";
    this.launcher.setAttribute("aria-expanded", "true");
    window.setTimeout(() => {
      this.input.focus({ preventScroll: true });
      this.transcript.scrollTop = this.transcript.scrollHeight;
    }, 60);
    document.dispatchEvent(new CustomEvent("elp-dh:open", { detail: { persona: this.persona.key } }));
  }

  close() {
    if (!this.open) return;
    if (this.voice) this.voice.stop();
    this.open = false;
    this.panel.hidden = true;
    this.root.dataset.state = "closed";
    this.launcher.setAttribute("aria-expanded", "false");
    this.launcher.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent("elp-dh:close", { detail: { persona: this.persona.key } }));
  }

  onKeydown(event) {
    if (event.key === "Escape" && this.open) {
      event.preventDefault();
      this.close();
    }
  }

  destroy() {
    if (typeof this.stopFormWatch === "function") this.stopFormWatch();
    if (this.onVoicesChanged && window.speechSynthesis) {
      try { window.speechSynthesis.removeEventListener("voiceschanged", this.onVoicesChanged); } catch (_) {}
    }
    this.removeIntro();
    if (this.voice) this.voice.destroy();
    if (typeof this.unsubscribeVoice === "function") this.unsubscribeVoice();
    this.root.remove();
    this.mounted = false;
  }
}

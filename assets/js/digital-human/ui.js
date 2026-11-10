// Assistant shell: launcher, panel, transcript, captions and responsive states.

import { COMPANY, VERSION } from "./config.js";

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

function actionLink(action) {
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
  constructor({ persona, conversation, onSend, onReset, mounted }) {
    this.persona = persona;
    this.conversation = conversation;
    this.onSend = onSend;
    this.onReset = onReset;
    this.mounted = mounted;
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
    launcher.appendChild(avatar(this.persona, "elp-dh-launcher__avatar"));
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
    header.appendChild(avatar(this.persona, "elp-dh-header__avatar"));
    const identity = el("div", "elp-dh-identity");
    const title = el("h2", "elp-dh-title", this.persona.name);
    title.id = "elp-dh-title";
    identity.appendChild(title);
    identity.appendChild(el("p", "elp-dh-department", `${this.persona.department} · Digital assistant`));
    header.appendChild(identity);

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
    const send = el("button", "elp-dh-send", "Send");
    send.type = "submit";
    form.appendChild(label);
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

    const footer = el("footer", "elp-dh-footer");
    footer.appendChild(el("span", "", "Typed conversation · captions always on · voice arrives in the next phase"));
    this.footer = footer;
    panel.appendChild(footer);

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
        for (const action of message.actions) actions.appendChild(actionLink(action));
        row.appendChild(actions);
      }
      transcript.appendChild(row);
    }
    transcript.scrollTop = transcript.scrollHeight;
  }

  append(message) {
    const row = el("div", `elp-dh-msg elp-dh-msg--${message.role}`);
    row.appendChild(el("div", "elp-dh-bubble", message.text));
    if (Array.isArray(message.actions) && message.actions.length) {
      const actions = el("div", "elp-dh-actions");
      for (const action of message.actions) actions.appendChild(actionLink(action));
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

  submit(text) {
    const value = String(text || "").trim();
    if (!value) return;
    this.append({ role: "user", text: value });
    this.thinking(true);
    this.sendButton.disabled = true;
    window.setTimeout(() => {
      this.thinking(false);
      this.sendButton.disabled = false;
      const reply = this.onSend(value);
      this.append({
        role: "assistant",
        text: reply ? reply.text : "I'm here.",
        actions: reply ? reply.actions : []
      });
      this.input.focus();
    }, 360);
  }

  reset() {
    const messages = this.onReset();
    this.render(messages);
    this.input.focus();
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  show() {
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
    this.root.remove();
    this.mounted = false;
  }
}

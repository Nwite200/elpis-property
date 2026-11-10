// Elpis Property — passkeys (WebAuthn) frontend.
// Login button, post-login registration prompt and device management.
(function () {
  const SWA = window.SimpleWebAuthnBrowser || null;
  const supportsPasskeys = () => !!(window.PublicKeyCredential && SWA && SWA.browserSupportsWebAuthn());

  function deviceLabel() {
    const ua = navigator.userAgent || "";
    if (/iPhone/i.test(ua)) return "iPhone";
    if (/iPad/i.test(ua)) return "iPad";
    if (/Android/i.test(ua)) return "Android device";
    if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
    if (/Windows/i.test(ua)) return "Windows PC";
    if (/Linux/i.test(ua)) return "Linux device";
    return "This device";
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  async function jsonFetch(url, options = {}) {
    const res = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function friendlyPasskeyError(error) {
    const cause = (error && error.cause && error.cause.name) || (error && error.name) || "";
    const message = String((error && error.message) || "");
    if (cause === "InvalidStateError" || /previously registered|already registered/i.test(message)) {
      return "This device already has a passkey for your account. You can sign in with it, or rename/remove it under Passkeys & Devices.";
    }
    if (cause === "AbortError" || /cancel|abort/i.test(message)) {
      return "The passkey prompt was cancelled. Try again when you are ready.";
    }
    if (cause === "SecurityError" || /invalid domain|rp id|rpId|SecurityError/i.test(message)) {
      return "Passkeys are tied to the exact site address. Use https://elpisproperty.org (without www or the workers.dev link) and try again.";
    }
    if (cause === "NotAllowedError" || /timed out|not allowed|privacy/i.test(message)) {
      return "The device prompt was cancelled, timed out, or this device has no fingerprint, Face ID, Windows Hello or screen-lock PIN set up. Make sure your device has a screen lock, then try again — or sign in with your password.";
    }
    return message || "Passkey operation failed. Please try again or use your password.";
  }

  function fingerprintIcon() {
    return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7v3h2V9a5 5 0 0 1 10 0v1.1a9.9 9.9 0 0 1-.4 2.9l1.9.6c.3-1.1.5-2.3.5-3.5V9a7 7 0 0 0-7-7Zm0 3a4 4 0 0 0-4 4v3.4c0 2.2-.4 4.3-1.2 6.3l1.9.7A17 17 0 0 0 10 12.4V9a2 2 0 0 1 4 0v3.5c0 2.6.4 5.1 1.1 7.5l1.9-.6a27 27 0 0 1-1-6.9V9a4 4 0 0 0-4-4Zm-7 8v2.4c0 2-.3 3.9-.9 5.7l1.9.6c.7-2 .9-4.1.9-6.3V13H5Z"/></svg>';
  }

  async function registerPasskey(name) {
    if (!supportsPasskeys()) throw new Error("This browser does not support passkeys.");
    const { challengeId, options } = await jsonFetch("/api/passkeys/register/options", { method: "POST", body: "{}" });
    const response = await SWA.startRegistration({ optionsJSON: options });
    return jsonFetch("/api/passkeys/register/verify", {
      method: "POST",
      body: JSON.stringify({ challengeId, response, name: name || deviceLabel() })
    });
  }

  async function loginWithPasskey(email) {
    if (!supportsPasskeys()) throw new Error("This browser does not support passkeys.");
    const { challengeId, options } = await jsonFetch("/api/passkeys/login/options", {
      method: "POST",
      body: JSON.stringify({ email: email || "" })
    });
    const response = await SWA.startAuthentication({ optionsJSON: options });
    const result = await jsonFetch("/api/passkeys/login/verify", {
      method: "POST",
      body: JSON.stringify({ challengeId, response })
    });
    window.location.href = result.redirect || "/dashboard.html";
  }

  function addPasskeyLoginButton(form, emailInput) {
    if (document.getElementById("passkeyLoginBtn")) return;
    const wrap = el("div", "passkey-login-wrap");
    const divider = el("div", "passkey-divider", "or");
    const button = el("button", "btn btn-outline btn-block passkey-login-btn");
    button.type = "button";
    button.id = "passkeyLoginBtn";
    button.innerHTML = `${fingerprintIcon()}<span>Continue with Passkey</span>`;
    const note = el("p", "passkey-note", "Fingerprint, Face ID, Windows Hello or your device PIN.");
    wrap.appendChild(divider);
    wrap.appendChild(button);
    wrap.appendChild(note);
    form.appendChild(wrap);
    if (!supportsPasskeys()) {
      button.disabled = true;
      note.textContent = "This browser or device does not support passkeys. Use your password, or try Chrome, Edge or Safari on a supported device.";
      return;
    }
    button.addEventListener("click", async () => {
      const msg = document.getElementById("msg") || document.getElementById("loginMsg");
      button.disabled = true;
      const original = button.innerHTML;
      button.textContent = "Waiting for your device…";
      try {
        const email = emailInput && emailInput.value.includes("@") ? emailInput.value.trim() : "";
        await loginWithPasskey(email);
      } catch (error) {
        if (msg) msg.textContent = friendlyPasskeyError(error);
        button.disabled = false;
        button.innerHTML = original;
      }
    });
  }

  function modal(title, bodyNode, actions) {
    const backdrop = el("div", "passkey-modal-backdrop");
    const card = el("div", "passkey-modal");
    card.appendChild(el("h2", "passkey-modal-title", title));
    if (typeof bodyNode === "string") card.appendChild(el("p", "passkey-modal-text", bodyNode));
    else card.appendChild(bodyNode);
    const row = el("div", "passkey-modal-actions");
    for (const action of actions) {
      const button = el("button", action.secondary ? "btn btn-outline" : "btn btn-brand", action.label);
      button.type = "button";
      button.addEventListener("click", () => action.onClick(backdrop));
      row.appendChild(button);
    }
    card.appendChild(row);
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    return backdrop;
  }

  async function promptAfterLogin() {
    if (sessionStorage.getItem("elp-passkey-prompt") !== "1") return;
    sessionStorage.removeItem("elp-passkey-prompt");
    if (sessionStorage.getItem("elp-passkey-checked") === "1") return;
    sessionStorage.setItem("elp-passkey-checked", "1");
    if (!supportsPasskeys()) return;
    if (localStorage.getItem("elp-passkey-dismissed") === "1") return;
    try {
      const me = await fetch("/api/me", { credentials: "same-origin" });
      if (!me.ok) return;
      const data = await jsonFetch("/api/passkeys");
      if ((data.passkeys || []).length) return;
      setTimeout(() => {
        const body = el("p", "passkey-modal-text", "Your device can keep the passkey securely. We never see your fingerprint, face or PIN.");
        modal("Enable fingerprint or Face ID login?", body, [
          { label: "Not now", secondary: true, onClick: close => { localStorage.setItem("elp-passkey-dismissed", "1"); close.remove(); } },
          {
            label: "Enable now",
            onClick: async close => {
              try {
                await registerPasskey(deviceLabel());
                close.remove();
                sessionStorage.setItem("elp-passkey-added", "1");
                window.location.reload();
              } catch (error) {
                const text = close.querySelector(".passkey-modal-text");
                if (text) text.textContent = friendlyPasskeyError(error);
              }
            }
          }
        ]);
      }, 1200);
    } catch (_) { /* not signed in */ }
  }

  function formatDate(value) {
    if (!value) return "Never";
    const date = new Date(String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "Z"));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  }

  async function initManagement() {
    const list = document.getElementById("passkeyList");
    const addBtn = document.getElementById("addPasskeyBtn");
    const message = document.getElementById("passkeyPageMsg");
    if (!list) return;
    if (!supportsPasskeys()) {
      addBtn.disabled = true;
      if (message) message.textContent = "This browser does not support passkeys. Try Chrome, Edge, Safari or a supported mobile device.";
    }
    async function load() {
      try {
        const me = await fetch("/api/me", { credentials: "same-origin" });
        if (!me.ok) { window.location.href = "/login.html"; return; }
        const data = await jsonFetch("/api/passkeys");
        list.innerHTML = "";
        const items = data.passkeys || [];
        if (!items.length) {
          list.appendChild(el("div", "empty-state", "No passkeys yet. Add one to sign in with your fingerprint, face or device PIN."));
          return;
        }
        for (const item of items) {
          const card = el("div", "passkey-device");
          const info = el("div", "passkey-device-info");
          const title = el("strong", "", item.name || "Passkey");
          const meta = el("div", "small muted", `Added ${formatDate(item.created_at)} · Last used ${formatDate(item.last_used_at)}`);
          const type = el("div", "small muted", item.device_type === "multiDevice" ? "Synced passkey" : "Device-bound passkey");
          info.appendChild(title);
          info.appendChild(meta);
          info.appendChild(type);
          const actions = el("div", "passkey-device-actions");
          const rename = el("button", "btn btn-outline", "Rename");
          rename.type = "button";
          rename.addEventListener("click", async () => {
            const name = window.prompt("Name this device", item.name || "My device");
            if (!name) return;
            try { await jsonFetch(`/api/passkeys/${item.id}`, { method: "PATCH", body: JSON.stringify({ name }) }); load(); }
            catch (error) { if (message) message.textContent = error.message; }
          });
          const remove = el("button", "btn btn-outline passkey-danger", "Remove");
          remove.type = "button";
          remove.addEventListener("click", async () => {
            if (!window.confirm("Remove this passkey? You can still sign in with your password.")) return;
            const password = window.prompt("Confirm your account password to remove this passkey");
            if (!password) return;
            try {
              await jsonFetch(`/api/passkeys/${item.id}`, { method: "DELETE", body: JSON.stringify({ password }) });
              if (message) message.textContent = "Passkey removed.";
              load();
            } catch (error) { if (message) message.textContent = error.message; }
          });
          actions.appendChild(rename);
          actions.appendChild(remove);
          card.appendChild(info);
          card.appendChild(actions);
          list.appendChild(card);
        }
      } catch (error) {
        if (message) message.textContent = error.message;
      }
    }
    addBtn.addEventListener("click", async () => {
      addBtn.disabled = true;
      addBtn.textContent = "Waiting for your device…";
      try {
        await registerPasskey(deviceLabel());
        if (message) message.textContent = "Passkey added.";
        await load();
      } catch (error) {
        if (message) message.textContent = friendlyPasskeyError(error);
      } finally {
        addBtn.disabled = !supportsPasskeys();
        addBtn.textContent = "Add a passkey";
      }
    });
    await load();
  }

  window.ElpisPasskeys = { registerPasskey, loginWithPasskey, supportsPasskeys };

  document.addEventListener("DOMContentLoaded", () => {
    const staffForm = document.getElementById("loginForm");
    const clientForm = document.getElementById("clientLoginForm");
    if (staffForm) addPasskeyLoginButton(staffForm, document.getElementById("email"));
    if (clientForm) addPasskeyLoginButton(clientForm, document.getElementById("clientIdentifier"));
    if (document.getElementById("passkeyList")) initManagement();
    else if (!staffForm && !clientForm && !document.body.classList.contains("assistant-page")) promptAfterLogin();
  });
})();

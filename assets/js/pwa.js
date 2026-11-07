// Elpis Property Limited — PWA install experience.
// Front-end only. API, auth and financial logic are untouched.
(function () {
  "use strict";

  var deferredPrompt = null;
  var installButton = null;
  var sheet = null;
  var lastFocus = null;
  var dismissed = false;

  try {
    dismissed = window.sessionStorage.getItem("elpis_install_dismissed") === "1";
  } catch (error) {
    dismissed = false;
  }

  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
  }

  function isIOS() {
    var ua = window.navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) return true;
    // iPadOS 13+ identifies as Macintosh but exposes touch points.
    return /macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1;
  }

  function isAndroid() {
    return /android/i.test(window.navigator.userAgent);
  }

  function injectStyles() {
    if (document.getElementById("elpisPwaStyles")) return;
    var style = document.createElement("style");
    style.id = "elpisPwaStyles";
    style.textContent = [
      ".elpis-install-btn{position:fixed;right:16px;bottom:18px;z-index:140;display:none;align-items:center;gap:8px;",
      "border:1px solid rgba(232,181,45,.28);background:#fff;color:#9a6b00;border-radius:999px;padding:10px 15px;",
      "font:700 12px/1 'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;cursor:pointer;",
      "box-shadow:0 10px 28px rgba(7,23,71,.16);transition:transform .18s ease,box-shadow .18s ease}",
      ".elpis-install-btn:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(7,23,71,.2)}",
      ".elpis-install-btn .elpis-install-icon{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;",
      "background:#e8b52d;color:#071747;font-size:13px}",
      ".elpis-install-btn.has-wa{bottom:92px}",
      ".elpis-install-sheet{position:fixed;inset:0;z-index:150;display:none;align-items:flex-end;justify-content:center;",
      "background:rgba(7,23,71,.4);padding:16px}",
      ".elpis-install-sheet.open{display:flex}",
      ".elpis-install-card{width:min(100%,430px);background:#fff;border-radius:18px;padding:24px;",
      "box-shadow:0 24px 70px rgba(7,23,71,.28);font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;",
      "color:#26344f;position:relative}",
      ".elpis-install-card h2{margin:0 0 8px;font:600 24px/1.25 'Cormorant Garamond',Georgia,serif;color:#071747}",
      ".elpis-install-card p{margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b7690}",
      ".elpis-install-card ol{margin:0 0 18px;padding-left:20px;font-size:13px;line-height:1.8;color:#26344f}",
      ".elpis-install-card strong{color:#9a6b00}",
      ".elpis-install-close{position:absolute;right:12px;top:10px;border:0;background:transparent;color:#98a0b3;font-size:22px;cursor:pointer;",
      "width:34px;height:34px;border-radius:50%}",
      ".elpis-install-close:hover{background:#f7f6f2;color:#071747}",
      ".elpis-install-ok{width:100%;border:0;border-radius:10px;background:#e8b52d;color:#071747;padding:12px;font:700 13px 'DM Sans',sans-serif;cursor:pointer}",
      "@media(min-width:640px){.elpis-install-sheet{align-items:center}}"
    ].join("");
    document.head.appendChild(style);
  }

  function createButton() {
    if (installButton) return installButton;
    injectStyles();
    installButton = document.createElement("button");
    installButton.type = "button";
    installButton.className = "elpis-install-btn";
    installButton.setAttribute("aria-label", "Install the Elpis Property app");
    installButton.innerHTML = '<span class="elpis-install-icon" aria-hidden="true">↓</span><span>Install app</span>';
    installButton.addEventListener("click", function () {
      if (deferredPrompt) {
        var promptEvent = deferredPrompt;
        deferredPrompt = null;
        promptEvent.prompt();
        Promise.resolve(promptEvent.userChoice).catch(function () {}).then(function () {
          hideButton();
        });
      } else {
        openInstructions();
      }
    });
    if (document.querySelector(".wa-float")) installButton.classList.add("has-wa");
    document.body.appendChild(installButton);
    return installButton;
  }

  function showButton(label) {
    if (dismissed || isStandalone()) return;
    createButton();
    if (label) installButton.querySelector("span:last-child").textContent = label;
    installButton.style.display = "inline-flex";
  }

  function hideButton() {
    if (installButton) installButton.style.display = "none";
  }

  function openInstructions() {
    if (sheet) {
      sheet.classList.add("open");
      var closeBtn = sheet.querySelector(".elpis-install-close");
      if (closeBtn) closeBtn.focus();
      return;
    }
    injectStyles();
    sheet = document.createElement("div");
    sheet.className = "elpis-install-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", "elpisInstallTitle");

    var steps = isIOS()
      ? "<ol><li>Tap the <strong>Share</strong> button in Safari.</li><li>Scroll and tap <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong> to finish.</li></ol>"
      : "<ol><li>Open the browser menu <strong>⋮</strong>.</li><li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>Confirm to add Elpis Property to your home screen.</li></ol>";

    sheet.innerHTML = [
      '<div class="elpis-install-card">',
      '<button type="button" class="elpis-install-close" aria-label="Close install instructions">×</button>',
      '<h2 id="elpisInstallTitle">Install Elpis Property</h2>',
      '<p>Add the app to your home screen for faster access and an app-like experience.</p>',
      steps,
      '<button type="button" class="elpis-install-ok">Got it</button>',
      "</div>"
    ].join("");

    lastFocus = document.activeElement;
    document.body.appendChild(sheet);
    sheet.classList.add("open");

    var close = function () {
      sheet.classList.remove("open");
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    };
    sheet.querySelector(".elpis-install-close").addEventListener("click", close);
    sheet.querySelector(".elpis-install-ok").addEventListener("click", close);
    sheet.addEventListener("click", function (event) {
      if (event.target === sheet) close();
    });
    document.addEventListener("keydown", function onEscape(event) {
      if (event.key === "Escape" && sheet && sheet.classList.contains("open")) {
        close();
        document.removeEventListener("keydown", onEscape);
      }
    });
    sheet.querySelector(".elpis-install-close").focus();
  }

  window.elpisPWA = {
    install: function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
      } else {
        openInstructions();
      }
    },
    canInstall: function () { return Boolean(deferredPrompt); },
    showInstructions: openInstructions
  };

  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {
        /* Non-blocking: the site remains fully usable without offline support. */
      });
    });
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
    showButton("Install app");
  });

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    hideButton();
  });

  if (isIOS()) {
    window.setTimeout(function () { showButton("Add to Home Screen"); }, 1400);
  } else if (isAndroid()) {
    window.setTimeout(function () {
      if (!deferredPrompt) showButton("Install app");
    }, 2500);
  }
})();

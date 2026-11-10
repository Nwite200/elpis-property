// One logout path for every portal: end the server session, clear assistant
// state, then land on the public page. Runs in capture so page-specific
// handlers cannot redirect back into a dashboard.
(function () {
  const KEYS = [
    "elp-dh-transcript-v1",
    "elp-dh-payments-v1",
    "elp-dh-hidden",
    "elp-dh-intro-home-at",
    "elp-dh-intro-dashboard-at",
    "elp-passkey-prompt",
    "elp-passkey-checked"
  ];

  function clearClientState() {
    for (const key of KEYS) {
      try { sessionStorage.removeItem(key); } catch (_) { /* ignore */ }
    }
    try { sessionStorage.removeItem("elp-dh-transcript-v1"); } catch (_) { /* ignore */ }
  }

  async function logout() {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    } catch (_) { /* still leave the portal */ }
    clearClientState();
    window.location.href = "/";
  }

  document.addEventListener("click", event => {
    const trigger = event.target && event.target.closest && event.target.closest("#logoutBtn, [data-logout]");
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    logout();
  }, true);

  window.ElpisSession = { logout, clearClientState };
})();

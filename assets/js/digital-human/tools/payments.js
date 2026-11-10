// Phase 8 payment announcements. Polls the existing notification endpoint and
// only reacts to verified payment events. No webhook, amount or status is
// invented on the client; pending/failed payments never produce a success line.

const POLL_MS = 25000;
const CACHE_KEY = "elp-dh-payments-v1";

function paymentEvent(context, notification) {
  const message = notification.message || "";
  if (context.isClient) {
    return {
      text: `Payment to ELPIS ACCESS successful. Your payment has been confirmed. Thank you for choosing Elpis Property. ${message}${notification.created_at ? ` (${notification.created_at})` : ""}`,
      actions: [
        { label: "Open payments", href: "client-payments.html" },
        { label: "Open receipts", href: "client-receipts.html" }
      ]
    };
  }
  return {
    text: `Customer payment successful. A client assigned to your account has completed a payment. ${message}`,
    actions: [
      { label: "Finance dashboard", href: "finance-dashboard.html" },
      { label: "Notifications", href: "staff-notifications.html" }
    ]
  };
}

export function createPaymentWatcher(context, onEvent) {
  const endpoint = context.isClient ? "/api/client/notifications" : "/api/staff/notifications?limit=20";
  let baseline = null;
  let timer = null;
  const announced = new Set();

  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (cached && Number.isFinite(Number(cached.baseline))) {
      baseline = Number(cached.baseline);
      for (const id of cached.announced || []) announced.add(Number(id));
    }
  } catch (_) { /* ignore */ }

  function persist() {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ baseline, announced: [...announced].slice(-50) }));
    } catch (_) { /* ignore */ }
  }

  async function fetchNotifications() {
    const res = await fetch(endpoint, { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.notifications) ? data.notifications : [];
  }

  async function checkNow() {
    const list = await fetchNotifications();
    if (!list) return [];
    const maxId = list.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0);
    if (baseline === null) {
      baseline = maxId;
      persist();
      return [];
    }
    const fresh = list
      .filter(item => Number(item.id || 0) > baseline && !announced.has(Number(item.id)))
      .filter(item => item.type === "payment.verified")
      .sort((a, b) => Number(a.id) - Number(b.id))
      .slice(-3);
    if (maxId > baseline) {
      baseline = maxId;
      persist();
    }
    const events = [];
    for (const item of fresh) {
      announced.add(Number(item.id));
      const event = paymentEvent(context, item);
      events.push({ ...event, notification: item });
      onEvent && onEvent(event, item);
    }
    if (fresh.length) persist();
    return events;
  }

  function start() {
    if (timer) return;
    checkNow().catch(() => {});
    timer = window.setInterval(() => {
      if (!document.hidden) checkNow().catch(() => {});
    }, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
  }

  function onVisible() {
    if (!document.hidden) checkNow().catch(() => {});
  }

  function stop() {
    if (timer) { window.clearInterval(timer); timer = null; }
    document.removeEventListener("visibilitychange", onVisible);
  }

  return { start, stop, checkNow, baseline: () => baseline };
}

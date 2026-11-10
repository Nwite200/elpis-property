// Staff acceptance panel for assistant handovers (Phase 9).
// Renders only for signed-in staff and only shows requests assigned to them.

(function () {
  const host = document.querySelector(".dash-main");
  if (!host) return;

  const card = document.createElement("div");
  card.className = "card";
  card.style.marginTop = "18px";
  card.id = "assistantHandoverCard";
  const head = document.createElement("div");
  head.className = "card-head";
  const title = document.createElement("h3");
  title.textContent = "Assistant handover requests";
  const count = document.createElement("span");
  count.className = "small muted";
  count.textContent = "Loading…";
  head.appendChild(title);
  head.appendChild(count);
  const list = document.createElement("div");
  list.id = "assistantHandoverList";
  list.style.marginTop = "14px";
  card.appendChild(head);
  card.appendChild(list);
  host.appendChild(card);

  function rowFor(item) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:12px 0;border-top:1px solid var(--brand-line)";
    const info = document.createElement("div");
    info.style.cssText = "min-width:220px;flex:1 1 260px";
    const name = document.createElement("strong");
    name.textContent = item.requester_name || "Signed-in user";
    const meta = document.createElement("div");
    meta.className = "small muted";
    meta.textContent = `${item.department || "General"} · ${item.requested_at || ""}`;
    const summary = document.createElement("div");
    summary.className = "small";
    summary.style.marginTop = "4px";
    summary.textContent = item.summary || "Live handover request";
    info.appendChild(name);
    info.appendChild(meta);
    info.appendChild(summary);

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px";
    const accept = document.createElement("button");
    accept.className = "btn btn-gold";
    accept.type = "button";
    accept.textContent = "Accept";
    const decline = document.createElement("button");
    decline.className = "btn btn-outline";
    decline.type = "button";
    decline.textContent = "Decline";
    const respond = action => {
      accept.disabled = true;
      decline.disabled = true;
      fetch(`/api/assistant/handovers/${encodeURIComponent(item.id)}/respond`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      }).then(res => {
        if (!res.ok) throw new Error("Could not update this handover");
        load();
      }).catch(error => {
        accept.disabled = false;
        decline.disabled = false;
        meta.textContent = error.message;
      });
    };
    accept.addEventListener("click", () => respond("accept"));
    decline.addEventListener("click", () => respond("decline"));
    actions.appendChild(accept);
    actions.appendChild(decline);
    row.appendChild(info);
    row.appendChild(actions);
    return row;
  }

  function load() {
    fetch("/api/assistant/handovers?status=requested", {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    }).then(res => {
      if (!res.ok) throw new Error("unavailable");
      return res.json();
    }).then(data => {
      list.textContent = "";
      const rows = data.handovers || [];
      count.textContent = rows.length ? `${rows.length} waiting` : "No open requests";
      if (!rows.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "No assistant handovers are waiting for you.";
        list.appendChild(empty);
        return;
      }
      for (const item of rows) list.appendChild(rowFor(item));
    }).catch(() => {
      count.textContent = "Unavailable";
      list.textContent = "";
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Could not load handover requests.";
      list.appendChild(empty);
    });
  }

  load();
})();

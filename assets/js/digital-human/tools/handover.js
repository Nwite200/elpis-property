// Phase 9 human handover. The assistant can request a real staff member, but a
// transfer is never reported as active until that staff member accepts.

export function contactFallback(context) {
  const actions = [{ label: "Contact the team", href: "index.html#contact" }];
  if (context.contact && context.contact.email) actions.push({ label: "Email the team", href: `mailto:${context.contact.email}` });
  if (context.contact && context.contact.phone) actions.push({ label: "Call the team", href: `tel:${String(context.contact.phone).replace(/\s+/g, "")}` });
  return actions;
}

export async function handoverOptions(context, reason) {
  if (!context.signedIn) {
    return {
      text: "A live handover needs a signed-in account so the team knows who they are speaking to. You can sign in, or contact the team directly right now.",
      actions: [{ label: "Staff sign in", href: "login.html" }, { label: "Client sign in", href: "client-login.html" }, ...contactFallback(context)]
    };
  }
  let res;
  try {
    res = await fetch("/api/assistant/staff", { credentials: "same-origin", headers: { Accept: "application/json" } });
  } catch (_) {
    return { text: "I couldn't reach the staff directory just now. You can still contact the team directly.", actions: contactFallback(context) };
  }
  if (!res.ok) {
    return { text: "I couldn't check staff availability just now. You can still contact the team directly.", actions: contactFallback(context) };
  }
  const data = await res.json();
  const available = (data.staff || []).filter(person => person.available).slice(0, 2);
  if (!available.length) {
    return {
      text: "No team member is showing as available right now. I can log a callback request instead, or you can contact the team directly.",
      actions: [{ label: "Request a callback", href: "index.html#contact" }, ...contactFallback(context)]
    };
  }
  const names = available.map(person => `${person.full_name} (${person.role}${person.branch_name ? `, ${person.branch_name}` : ""})`).join("; ");
  return {
    text: `I can request a live handover. Available now: ${names}. Choose a person — the transfer only starts after they accept.`,
    actions: [
      ...available.map(person => ({
        label: `Connect me to ${person.full_name}`,
        action: "handover",
        staffId: person.id,
        staffName: person.full_name
      })),
      { label: "Callback instead", href: "index.html#contact" }
    ]
  };
}

export async function requestHandover(context, { staffId, staffName, summary }) {
  if (!context.signedIn) {
    return { text: "Please sign in before requesting a handover.", actions: [{ label: "Sign in", href: "login.html" }] };
  }
  let res;
  try {
    res = await fetch("/api/assistant/handovers", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        staff_user_id: staffId,
        summary: summary || `Live handover from ${context.pageLabel}`,
        department: context.roleGroup,
        persona_key: "adaora",
        branch_id: context.branchId || null,
        context: { page: context.page, role: context.actualRole || context.role, path: context.pathname }
      })
    });
  } catch (_) {
    return { text: "I couldn't send the handover request just now. Please try again or contact the team directly.", actions: contactFallback(context) };
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { text: data.error || "I couldn't send the handover request just now.", actions: contactFallback(context) };
  }
  const data = await res.json();
  const handover = data.handover || {};
  return {
    text: `I've sent the request to ${staffName || handover.staff_name}. The transfer is **not** active until they accept — I'll tell you here the moment they do.`,
    handoverId: handover.id,
    actions: [{ label: "Contact the team meanwhile", href: "index.html#contact" }]
  };
}

export async function checkHandover(handoverId) {
  try {
    const res = await fetch(`/api/assistant/handovers/${encodeURIComponent(handoverId)}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.handover || null;
  } catch (_) {
    return null;
  }
}

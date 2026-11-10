// Dashboard intelligence for Phase 5. Read-only: every call uses the signed-in
// user's cookie and the existing role-scoped endpoints. Nothing is fabricated.

import { quickActionsFor } from "../context.js";

const NGN = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
const naira = value => NGN.format(Number(value || 0));
const kobo = value => naira(Number(value || 0) / 100);

const ENDPOINTS = {
  client: "/api/client/dashboard",
  finance: "/api/finance/overview",
  accountant: "/api/accountant/earnings",
  admin: "/api/admin/overview",
  care: "/api/customer-care/overview",
  marketer: "/api/dashboard",
  team: "/api/dashboard",
  manager: "/api/dashboard",
  staff: "/api/dashboard"
};

function errorReply(context, error) {
  if (error === "signin") {
    return {
      text: "Sign in and I can read your authorised dashboard. Staff and clients use different portals.",
      actions: [{ label: "Staff sign in", href: "login.html" }, { label: "Client sign in", href: "client-login.html" }]
    };
  }
  if (error === "forbidden") {
    return {
      text: "Your role does not include that dashboard, so I will not show its figures. These are the workspaces you can use.",
      actions: quickActionsFor(context)
    };
  }
  return {
    text: "I could not reach your dashboard just now. The workspace pages still work — please try again in a moment.",
    actions: quickActionsFor(context)
  };
}

function clientSummary(data) {
  const f = data.financials || {};
  let text = `Your agreed price is ${kobo(f.agreed_price_kobo)}. Verified payments: ${kobo(f.total_verified_kobo)} (${Number(f.payment_percentage || 0)}%). Outstanding balance: ${kobo(f.outstanding_balance_kobo)}.`;
  const next = data.next_payment;
  if (next && next.has_schedule) {
    text += ` Next installment: ${kobo(next.installment_amount_kobo)} due ${next.next_due_date}.`;
  } else if (next && next.message) {
    text += ` ${next.message}`;
  }
  return {
    text,
    actions: [
      { label: "Open payments", href: "client-payments.html" },
      { label: "Open receipts", href: "client-receipts.html" },
      { label: "My property", href: "client-property.html" }
    ]
  };
}

function financeSummary(data) {
  const s = data.summary || {};
  return {
    text: `Today: ${naira(s.today_verified_ngn)} verified. This month: ${naira(s.month_verified_ngn)}. Pending: ${Number(s.pending_count || 0)} (${naira(s.pending_ngn)}). Outstanding client balances: ${naira(s.outstanding_client_balances_ngn)}.`,
    actions: [
      { label: "Finance dashboard", href: "finance-dashboard.html" },
      { label: "Reports", href: "reports.html" }
    ]
  };
}

function accountantSummary(data) {
  const s = data.summary || {};
  return {
    text: `Collected: ${kobo(s.collected_kobo)}. Pending: ${kobo(s.pending_kobo)}. Outstanding: ${kobo(s.outstanding_kobo)}. Settlement difference: ${kobo(s.settlement_difference_kobo)}.`,
    actions: [
      { label: "Accountant dashboard", href: "accountant-dashboard.html" },
      { label: "Reports", href: "reports.html" }
    ]
  };
}

function adminSummary(data) {
  return {
    text: `There are ${Number(data.staff_count || 0)} active staff, ${Number(data.client_count || 0)} clients and ${Number(data.audit_count || 0)} audit records.`,
    actions: [
      { label: "Administration", href: "super-admin.html" },
      { label: "Staff", href: "staff-management.html" },
      { label: "Permissions", href: "permissions.html" }
    ]
  };
}

function careSummary(data) {
  return {
    text: `Care queue: ${Number(data.pending_clearance || 0)} pending clearance, ${Number(data.cleared || 0)} cleared and ${Number(data.calls_today || 0)} calls today across ${Number(data.total_clients || 0)} clients.`,
    actions: [{ label: "Open customer care", href: "customer-care.html" }]
  };
}

function staffSummary(data, context) {
  const s = data.summary || {};
  const clients = s.clients || {};
  const leads = s.leads || {};
  const properties = s.properties || {};
  const who = context.roleGroup === "marketer" ? "your book" : context.roleGroup === "team" ? "your team" : "your scope";
  return {
    text: `In ${who}: ${Number(clients.total || 0)} clients, ${Number(leads.open || 0)} open leads, ${Number(leads.follow_ups_due || 0)} follow-ups due and ${Number(properties.total || 0)} properties.`,
    actions: quickActionsFor(context)
  };
}

export function toolKind(context) {
  if (!context.signedIn) return "public";
  return ENDPOINTS[context.roleGroup] ? context.roleGroup : "public";
}

export async function summarizeDashboard(context) {
  if (!context.signedIn) return errorReply(context, "signin");
  const kind = toolKind(context);
  const endpoint = ENDPOINTS[kind];
  if (!endpoint) return errorReply(context, "forbidden");
  let res;
  try {
    res = await fetch(endpoint, { credentials: "same-origin", headers: { Accept: "application/json" } });
  } catch (_) {
    return errorReply(context, "network");
  }
  if (res.status === 401) return errorReply(context, "signin");
  if (res.status === 403) return errorReply(context, "forbidden");
  if (!res.ok) return errorReply(context, "unavailable");
  let data;
  try { data = await res.json(); } catch (_) { return errorReply(context, "unavailable"); }

  switch (kind) {
    case "client": return clientSummary(data);
    case "finance": return financeSummary(data);
    case "accountant": return accountantSummary(data);
    case "admin": return adminSummary(data);
    case "care": return careSummary(data);
    case "marketer":
    case "team":
    case "manager":
    case "staff": return staffSummary(data, context);
    default: return errorReply(context, "forbidden");
  }
}

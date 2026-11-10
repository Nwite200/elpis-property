// Page, identity and role context for the assistant. Read-only and fail-open.

const PAGE_LABELS = {
  "index.html": "the Elpis Property home page",
  "properties.html": "the property portfolio",
  "property.html": "a property page",
  "property-details.html": "a property detail page",
  "property-create.html": "property creation",
  "signup.html": "registration",
  "login.html": "staff sign-in",
  "client-login.html": "client sign-in",
  "client-register.html": "client registration",
  "forgot-password.html": "password reset",
  "dashboard.html": "the staff dashboard",
  "finance-dashboard.html": "the finance dashboard",
  "sub-admin-dashboard.html": "the sub-admin dashboard",
  "gsm-dashboard.html": "the GSM dashboard",
  "accountant-dashboard.html": "the accountant dashboard",
  "client-dashboard.html": "your client dashboard",
  "client-payments.html": "your payments",
  "client-receipts.html": "your receipts",
  "client-property.html": "your property",
  "client-profile.html": "your profile",
  "client-virtual-account.html": "your virtual account",
  "client-notifications.html": "your notifications",
  "leads.html": "the leads workspace",
  "clients.html": "the client register",
  "commissions.html": "commissions",
  "reports.html": "reports",
  "revenue.html": "revenue",
  "staff-management.html": "staff management",
  "permissions.html": "permissions",
  "super-admin.html": "system administration",
  "provider-config.html": "payment provider configuration",
  "sms-center.html": "the SMS centre",
  "activity-centre.html": "the activity centre",
  "performance.html": "performance analytics",
  "customer-care.html": "customer care",
  "defaulting.html": "defaulting accounts",
  "phone-cleanup.html": "phone cleanup",
  "staff-chat.html": "staff chat",
  "staff-notifications.html": "staff notifications",
  "referral-commissions.html": "referral commissions",
  "activity-centre.html": "the activity centre"
};

function pageKey(pathname) {
  const file = pathname.split("/").pop() || "index.html";
  return file === "" ? "index.html" : file;
}

function pageKind(page) {
  if (page === "index.html") return "home";
  if (["signup.html", "client-register.html", "login.html", "client-login.html", "forgot-password.html", "client-verify.html"].includes(page)) return "auth";
  if (page.startsWith("client-")) return "client";
  if (page.startsWith("property")) return "property";
  if (page.includes("dashboard")) return "dashboard";
  if (["leads.html", "clients.html", "commissions.html", "reports.html", "revenue.html", "staff-management.html", "permissions.html", "super-admin.html", "provider-config.html", "sms-center.html", "performance.html", "customer-care.html", "defaulting.html", "phone-cleanup.html", "activity-centre.html", "referral-commissions.html", "staff-chat.html", "staff-notifications.html"].includes(page)) return "operations";
  return "public";
}

function contactDetails() {
  const cfg = window.ELPIS_CONFIG || {};
  const branches = Array.isArray(cfg.branches) ? cfg.branches : [];
  const head = branches.find(b => b.isHeadOffice) || branches[0] || {};
  return {
    phone: cfg.phone || head.phone || "",
    email: cfg.email || "",
    whatsapp: cfg.whatsappNumber || "",
    address: cfg.address || head.address || ""
  };
}

export async function getContext() {
  const pathname = window.location.pathname;
  const page = pageKey(pathname);
  const kind = pageKind(page);
  const context = {
    pathname,
    page,
    pageLabel: PAGE_LABELS[page] || "this page",
    kind,
    signedIn: false,
    role: null,
    name: null,
    firstName: null,
    branchId: null,
    contact: contactDetails()
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch("/api/me", { credentials: "same-origin", signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const me = await res.json();
      context.signedIn = true;
      context.role = me.role || null;
      context.name = me.full_name || me.name || null;
      context.firstName = context.name ? String(context.name).split(" ")[0] : null;
      context.branchId = me.branch_id || null;
      context.isClient = me.role === "Client";
      context.isStaff = !!me.role && me.role !== "Client";
    }
  } catch (_) {
    // Public visitor, offline, or timed out: stay in public mode.
  }
  return context;
}

export function greetingFor(context, persona) {
  const first = context.firstName ? `, ${context.firstName}` : "";
  if (context.isClient) {
    return `Welcome back${first}. Your client dashboard is ready. I can help you find your next step, review your account or reach the team.`;
  }
  if (context.isStaff) {
    const role = context.role || "team member";
    if (context.kind === "dashboard") {
      return `Welcome back${first}. You're signed in as ${role}. I can guide you around this dashboard and point you to the right workspace.`;
    }
    return `Welcome back${first}. You're signed in as ${role}. I can guide you around ${context.pageLabel}.`;
  }
  if (context.kind === "auth") {
    return `Welcome to Elpis Property. I'm ${persona.name}. I can guide you through this form or help you find what you need.`;
  }
  if (context.kind === "property") {
    return `Welcome to Elpis Property. I'm ${persona.name}. I can help you explore the portfolio or connect you with the right team.`;
  }
  return `Welcome to Elpis Property. I'm ${persona.name}, your concierge. I can help you explore the portfolio, create an account or reach the right team.`;
}

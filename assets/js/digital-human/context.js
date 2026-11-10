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
  const raw = pathname.split("/").pop() || "";
  if (!raw) return "index.html";
  return raw.includes(".") ? raw : `${raw}.html`;
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
    actualRole: null,
    roleGroup: "public",
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
      context.actualRole = me.actual_role || me.role || null;
      context.name = me.full_name || me.name || null;
      context.firstName = context.name ? String(context.name).split(" ")[0] : null;
      context.branchId = me.branch_id || null;
      context.isClient = me.role === "Client";
      context.isStaff = !!me.role && me.role !== "Client";
      context.roleGroup = roleGroup(context);
    }
  } catch (_) {
    // Public visitor, offline, or timed out: stay in public mode.
  }
  return context;
}

export function roleGroup(context) {
  if (!context || !context.signedIn) return "public";
  const actual = context.actualRole || "";
  const role = context.role || "";
  if (role === "Client") return "client";
  if (actual === "Super Admin" || actual === "Sub Admin") return "admin";
  if (actual === "GSM") return "gsm";
  if (actual === "Accountant") return "accountant";
  if (actual === "Head Accountant" || role === "Finance Officer") return "finance";
  if (role === "Marketer") return "marketer";
  if (role === "Team Lead") return "team";
  if (role === "Customer Care") return "care";
  if (["Managing Director", "Branch Manager", "Project Manager"].includes(role)) return "manager";
  return "staff";
}

export function quickActionsFor(context) {
  const link = (label, href) => ({ label, href });
  switch (context.roleGroup) {
    case "client":
      return [link("My payments", "client-payments.html"), link("My receipts", "client-receipts.html"), link("My property", "client-property.html"), link("Contact the team", "index.html#contact")];
    case "marketer":
      return [link("My leads", "leads.html"), link("My clients", "clients.html"), link("Performance", "performance.html")];
    case "team":
      return [link("Team performance", "performance.html"), link("Leads", "leads.html"), link("Activity centre", "activity-centre.html")];
    case "finance":
      return [link("Finance dashboard", "finance-dashboard.html"), link("Transactions", "finance-dashboard.html#transactions"), link("Reports", "reports.html")];
    case "accountant":
      return [link("Accountant dashboard", "accountant-dashboard.html"), link("Reports", "reports.html")];
    case "manager":
      return [link("Dashboard", "dashboard.html"), link("Revenue", "revenue.html"), link("Reports", "reports.html")];
    case "admin":
      return [link("Administration", "super-admin.html"), link("Staff", "staff-management.html"), link("Permissions", "permissions.html")];
    case "care":
      return [link("Care queue", "customer-care.html"), link("Clients", "customer-care.html")];
    case "gsm":
      return [link("GSM dashboard", "gsm-dashboard.html"), link("Leads", "leads.html")];
    default:
      return [
        link("Explore properties", "index.html#properties"),
        link("Create an account", "signup.html"),
        link("Contact the team", "index.html#contact")
      ];
  }
}

export function greetingFor(context, persona) {
  const first = context.firstName ? `, ${context.firstName}` : "";
  const name = persona ? persona.name : "Adaora";
  switch (context.roleGroup) {
    case "client":
      return `Welcome back${first}. Your dashboard is ready. Would you like to explore properties, review your enquiries or check your account?`;
    case "marketer":
      return `Welcome back${first}. Your marketer dashboard is ready. Let's review your client activities and follow-ups.`;
    case "finance":
    case "accountant":
      return `Welcome back${first}. Your account dashboard is ready. Let's review today's payment activities.`;
    case "team":
      return `Welcome back${first}. Your team dashboard is ready. Let's review the activities within your authorised team.`;
    case "manager":
      return `Welcome back${first}. Your management dashboard is ready. I can help you review your operational activities.`;
    case "admin":
      return `Welcome back${first}. Your administration dashboard is ready. What would you like to review?`;
    case "care":
      return `Welcome back${first}. Your customer care dashboard is ready. Let's review the care queue.`;
    case "gsm":
      return `Welcome back${first}. Your GSM dashboard is ready. What would you like to review?`;
    default:
      break;
  }
  if (context.kind === "auth") {
    return `Welcome to Elpis Property. I'm ${name}. I can guide you through this form or help you find what you need.`;
  }
  if (context.kind === "property") {
    return `Welcome to Elpis Property. I'm ${name}. I can help you explore the portfolio or connect you with the right team.`;
  }
  return `Welcome to Elpis Property. I'm ${name}, your concierge. I can help you explore the portfolio, create an account or reach the right team.`;
}

export function introTextFor(context) {
  const first = context.firstName ? `, ${context.firstName}` : "";
  switch (context.roleGroup) {
    case "client":
      return `Welcome back${first}. Your dashboard is ready. Would you like to explore properties, review your enquiries or check your account?`;
    case "marketer":
      return `Welcome back${first}. Your marketer dashboard is ready. Let's review your client activities and follow-ups.`;
    case "finance":
    case "accountant":
      return `Welcome back${first}. Your account dashboard is ready. Let's review today's payment activities.`;
    case "team":
      return `Welcome back${first}. Your team dashboard is ready. Let's review the activities within your authorised team.`;
    case "manager":
      return `Welcome back${first}. Your management dashboard is ready. I can help you review your operational activities.`;
    case "admin":
      return `Welcome back${first}. Your administration dashboard is ready. What would you like to review?`;
    case "care":
      return `Welcome back${first}. Your customer care dashboard is ready. Let's review the care queue.`;
    case "gsm":
      return `Welcome back${first}. Your GSM dashboard is ready. What would you like to review?`;
    default:
      return "Welcome to Elpis Property. I'm Adaora. I can help you explore the portfolio or reach the right team.";
  }
}

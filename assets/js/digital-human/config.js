// Elpis Property — digital human ecosystem configuration (Phase 2).
// Personas are data, not code: adding a specialist is one entry here.
// One-line rollback for the whole assistant: set ENABLED to false.

export const ENABLED = true;
export const VERSION = "4.0.0";
export const STORAGE_KEY = "elp-dh-transcript-v1";
export const MAX_TRANSCRIPT = 40;

export const COMPANY = "Elpis Property";

export const PERSONAS = [
  {
    key: "adaora",
    name: "Adaora",
    department: "Concierge",
    role: "Main Concierge",
    gender: "female",
    initials: "A",
    avatar: "assets/images/assistants/adaora.jpg",
    accent: "#E8B52D",
    available: true,
    scope: ["public", "client", "staff"],
    greeting: "Welcome to Elpis Property. I'm Adaora, your concierge. I can guide you around the platform and point you to the right team.",
    voice: { lang: "en-NG", rate: 1.0, pitch: 1.05, genderHint: "female", preferredNames: ["Ada", "Samantha", "Victoria", "Google UK English Female"] },
    quickActions: [
      { label: "Explore properties", href: "index.html#properties" },
      { label: "Create an account", href: "signup.html" },
      { label: "Contact the team", href: "index.html#contact" }
    ],
    handoverTo: ["solomon", "chiamaka", "emeka", "amara"]
  },
  {
    key: "solomon",
    name: "Solomon",
    department: "Property Discovery",
    role: "Property Discovery Specialist",
    gender: "male",
    initials: "S",
    avatar: "assets/images/assistants/solomon.jpg",
    accent: "#0B2A6B",
    available: true,
    scope: ["public", "client", "staff"],
    greeting: "Hello, I'm Solomon. Adaora shared your request. Let's find the right property for you.",
    voice: { lang: "en-NG", rate: 1.0, pitch: 0.95, genderHint: "male", preferredNames: ["Daniel", "Alex", "Google UK English Male"] },
    quickActions: [
      { label: "Browse the portfolio", href: "index.html#properties" },
      { label: "Talk to sales", href: "index.html#contact" }
    ],
    handoverTo: ["chiamaka", "emeka", "adaora"]
  },
  {
    key: "chiamaka",
    name: "Chiamaka",
    department: "Sales",
    role: "Sales Consultant",
    gender: "female",
    initials: "C",
    avatar: "assets/images/assistants/chiamaka.png",
    accent: "#C79A2E",
    available: true,
    scope: ["public", "client", "staff"],
    greeting: "Hello, I'm Chiamaka from Sales. I can explain how an Elpis purchase works.",
    voice: { lang: "en-NG", rate: 1.02, pitch: 1.1, genderHint: "female", preferredNames: ["Chiamaka", "Zira", "Samantha"] },
    quickActions: [{ label: "See available property", href: "index.html#properties" }],
    handoverTo: ["solomon", "adaora"]
  },
  {
    key: "emeka",
    name: "Emeka",
    department: "Rentals & Leasing",
    role: "Rental and Leasing Specialist",
    gender: "male",
    initials: "E",
    avatar: "assets/images/assistants/emeka.png",
    accent: "#123C7A",
    available: true,
    scope: ["public", "client", "staff"],
    greeting: "Hello, I'm Emeka. I look after rental and leasing enquiries.",
    voice: { lang: "en-NG", rate: 0.98, pitch: 0.92, genderHint: "male", preferredNames: ["Emeka", "Daniel", "Alex"] },
    quickActions: [{ label: "Rental enquiries", href: "index.html#contact" }],
    handoverTo: ["solomon", "adaora"]
  },
  {
    key: "amara",
    name: "Amara",
    department: "Customer Relations",
    role: "Customer Relations Specialist",
    gender: "female",
    initials: "A",
    avatar: "assets/images/assistants/amara.png",
    accent: "#B8862B",
    available: true,
    scope: ["client", "staff"],
    greeting: "Hello, I'm Amara from Customer Relations. I can help with your account and service questions.",
    voice: { lang: "en-NG", rate: 1.0, pitch: 1.08, genderHint: "female", preferredNames: ["Amara", "Samantha", "Zira"] },
    quickActions: [{ label: "Client portal", href: "client-login.html" }],
    handoverTo: ["adaora"]
  },
  {
    key: "david",
    name: "David",
    department: "Lead Intelligence",
    role: "Lead Intelligence Specialist",
    gender: "male",
    initials: "D",
    avatar: "assets/images/assistants/david.png",
    accent: "#0B2A6B",
    available: false,
    scope: ["staff"],
    greeting: "Hello, I'm David. I help authorised staff review assigned leads and follow-ups.",
    voice: { lang: "en-NG", rate: 1.0, pitch: 0.94, genderHint: "male", preferredNames: ["David", "Daniel", "Alex"] },
    quickActions: [{ label: "Open leads", href: "leads.html" }],
    handoverTo: ["adaora"]
  },
  {
    key: "ngozi",
    name: "Ngozi",
    department: "Property Management",
    role: "Property Management Specialist",
    gender: "female",
    initials: "N",
    avatar: "assets/images/assistants/ngozi.png",
    accent: "#C79A2E",
    available: false,
    scope: ["staff"],
    greeting: "Hello, I'm Ngozi. I support authorised property management operations.",
    voice: { lang: "en-NG", rate: 1.0, pitch: 1.04, genderHint: "female", preferredNames: ["Ngozi", "Zira", "Samantha"] },
    quickActions: [{ label: "Open properties", href: "properties.html" }],
    handoverTo: ["adaora"]
  },
  {
    key: "daniel",
    name: "Daniel",
    department: "Management Intelligence",
    role: "Management Intelligence Specialist",
    gender: "male",
    initials: "D",
    avatar: "assets/images/assistants/daniel.png",
    accent: "#123C7A",
    available: false,
    scope: ["staff"],
    greeting: "Hello, I'm Daniel. I help authorised managers review operational performance.",
    voice: { lang: "en-NG", rate: 0.97, pitch: 0.9, genderHint: "male", preferredNames: ["Daniel", "Alex", "Google UK English Male"] },
    quickActions: [{ label: "Open reports", href: "reports.html" }],
    handoverTo: ["adaora"]
  },
  {
    key: "ifeoma",
    name: "Ifeoma",
    department: "Branch Coordination",
    role: "Branch Coordinator",
    gender: "female",
    initials: "I",
    avatar: "assets/images/assistants/ifeoma.png",
    accent: "#B8862B",
    available: false,
    scope: ["public", "client", "staff"],
    greeting: "Hello, I'm Ifeoma. I help route enquiries to the right branch.",
    voice: { lang: "en-NG", rate: 1.01, pitch: 1.06, genderHint: "female", preferredNames: ["Ifeoma", "Zira", "Samantha"] },
    quickActions: [{ label: "Branch contact", href: "index.html#contact" }],
    handoverTo: ["adaora"]
  }
];

export function personaByKey(key) {
  return PERSONAS.find(p => p.key === key) || PERSONAS[0];
}

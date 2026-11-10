// Deterministic, intent-driven conversation for Phase 2.
// No LLM, no fabricated data and no privileged actions.

import { STORAGE_KEY, MAX_TRANSCRIPT, PERSONAS, personaByKey } from "./config.js";
import { greetingFor, quickActionsFor } from "./context.js";
import { summarizeDashboard } from "./tools/dashboard.js";

function scopeOf(context) {
  if (context.isStaff) return "staff";
  if (context.isClient) return "client";
  return "public";
}

function canUse(persona, context) {
  return !!persona && persona.available && persona.scope.includes(scopeOf(context));
}

function handoverIntro(target) {
  return `Let me introduce you to ${target.name}, our ${target.department} specialist. ${target.name} will take it from here.`;
}

function portfolioHref(context) {
  return context.isStaff ? "properties.html" : "index.html#properties";
}

function dashboardHref(context) {
  if (context.isClient) return "client-dashboard.html";
  if (context.isStaff) return "dashboard.html";
  return "login.html";
}

function contactActions(context) {
  const actions = [{ label: "Contact details", href: "index.html#contact" }];
  const c = context.contact || {};
  if (c.email) actions.push({ label: "Email the team", href: `mailto:${c.email}` });
  if (c.phone) actions.push({ label: "Call the team", href: `tel:${c.phone.replace(/\s+/g, "")}` });
  if (c.whatsapp) actions.push({ label: "WhatsApp", href: `https://wa.me/${c.whatsapp.replace(/\D/g, "")}`, external: true });
  return actions;
}

const INTENTS = [
  {
    key: "summary",
    test: /(summary|overview|how am i doing|what.?s pending|what is pending|what.?s due|today|my day|status|performance|figures|numbers|balance|outstanding|how much)/i,
    async reply(context) {
      return summarizeDashboard(context);
    }
  },
  {
    key: "property",
    handover: "solomon",
    test: /(property|properties|house|home|land|apartment|duplex|terrace|buy|purchase|portfolio|listing)/i,
    reply(context) {
      return {
        text: context.isStaff
          ? "You can open the live property register here. I can point you to it; conversational filtering arrives with our property specialist in the next phase."
          : "I can take you to the live Elpis portfolio. A property specialist who filters by budget, location and type is being onboarded next.",
        actions: [{ label: "Explore properties", href: portfolioHref(context) }]
      };
    }
  },
  {
    key: "viewing",
    handover: "solomon",
    test: /(viewing|view|inspection|visit|inspect)/i,
    reply() {
      return {
        text: "Viewings are arranged by the team. You can send an enquiry from any property page, or contact us directly and we will route it to the right branch.",
        actions: [{ label: "Send an enquiry", href: "index.html#contact" }]
      };
    }
  },
  {
    key: "sales",
    handover: "chiamaka",
    test: /(sales|sales process|purchase process|payment plan|buying process)/i,
    reply() {
      return {
        text: "I can explain how an Elpis purchase works and what the team needs from you. Start with the live portfolio, then send an enquiry and a sales consultant will follow up.",
        actions: [
          { label: "Explore properties", href: "index.html#properties" },
          { label: "Send an enquiry", href: "index.html#contact" }
        ]
      };
    }
  },
  {
    key: "rental",
    handover: "emeka",
    test: /(rent|rental|lease|leasing|tenant)/i,
    reply() {
      return {
        text: "I look after rental and leasing enquiries. Tell the team the location, budget and move-in date through the contact form and we will match the available options.",
        actions: [{ label: "Rental enquiry", href: "index.html#contact" }]
      };
    }
  },
  {
    key: "relations",
    handover: "amara",
    test: /(complaint|complain|issue|problem|not happy|unhappy|account help|customer care)/i,
    reply() {
      return {
        text: "I'm sorry you're dealing with that. I can point you to the fastest route to the customer relations team, and a person will pick it up from there.",
        actions: [
          { label: "Contact the team", href: "index.html#contact" },
          { label: "Client portal", href: "client-login.html" }
        ]
      };
    }
  },
  {
    key: "payment",
    test: /(payment|pay|receipt|balance|transaction|virtual account|outstanding|installment|instalment)/i,
    reply(context) {
      if (context.isClient) {
        return {
          text: "Your payment history, receipts and virtual account are in the client portal. I can open the payments page for you.",
          actions: [
            { label: "Open payments", href: "client-payments.html" },
            { label: "Open receipts", href: "client-receipts.html" }
          ]
        };
      }
      if (context.isStaff) {
        return {
          text: "Payment records are in the finance workspace. Your role controls what you can see there.",
          actions: [{ label: "Open finance dashboard", href: "finance-dashboard.html" }]
        };
      }
      return {
        text: "Payments and receipts are inside the secure client portal. Sign in with your client reference or email to see your account.",
        actions: [{ label: "Client sign in", href: "client-login.html" }]
      };
    }
  },
  {
    key: "account",
    test: /(account|dashboard|profile|my details|login|sign in|signin)/i,
    reply(context) {
      return {
        text: context.signedIn
          ? "I can take you to your dashboard. Your permissions still apply inside it."
          : "Sign in and I can guide you around your dashboard. Staff and clients use different portals.",
        actions: [
          { label: context.signedIn ? "Open dashboard" : "Staff sign in", href: context.signedIn ? dashboardHref(context) : "login.html" },
          { label: "Client sign in", href: "client-login.html" }
        ]
      };
    }
  },
  {
    key: "register",
    test: /(register|registration|sign up|signup|create.*account|new account)/i,
    reply() {
      return {
        text: "You can create a client account with your name, phone and email. The form will tell you if anything is missing or invalid.",
        actions: [
          { label: "Create an account", href: "signup.html" },
          { label: "Client registration", href: "client-register.html" }
        ]
      };
    }
  },
  {
    key: "human",
    test: /(human|agent|staff|person|talk to|speak to|call|whatsapp|contact|branch)/i,
    reply(context) {
      return {
        text: "I can point you to the team now. Live transfer to a staff member is being connected; until then, phone, email or WhatsApp will reach a person directly.",
        actions: contactActions(context)
      };
    }
  },
  {
    key: "who",
    test: /(who are you|your name|what are you|are you (a )?(bot|robot|human)|adaora|solomon|persona)/i,
    reply() {
      return {
        text: "I'm Adaora, the Elpis Property concierge. I'm a digital assistant, not a human. A specialist team — Solomon for property discovery, Chiamaka for sales, Emeka for rentals and Amara for client relations — is being onboarded to take over specific questions.",
        actions: [{ label: "Explore properties", href: "index.html#properties" }]
      };
    }
  },
  {
    key: "help",
    test: /(help|what can you do|options|guide|support)/i,
    reply(context) {
      return {
        text: "I can guide you to the property portfolio, registration, your dashboard, payments and the team. Type a question or choose an option below.",
        actions: [
          { label: "Explore properties", href: portfolioHref(context) },
          { label: "Create an account", href: "signup.html" },
          { label: "Contact the team", href: "index.html#contact" }
        ]
      };
    }
  },
  {
    key: "greeting",
    test: /^(hi|hello|hey|good (morning|afternoon|evening)|how are you)\b/i,
    reply(context) {
      const first = context.firstName ? `, ${context.firstName}` : "";
      return {
        text: `Hello${first}. I'm Adaora. What would you like to do — explore properties, open your dashboard, or speak to the team?`,
        actions: [
          { label: "Explore properties", href: portfolioHref(context) },
          { label: "Contact the team", href: "index.html#contact" }
        ]
      };
    }
  },
  {
    key: "thanks",
    test: /(thank|thanks|appreciate)/i,
    reply() {
      return { text: "You're welcome. I'm here if you need another pointer.", actions: [] };
    }
  }
];

function fallback(context) {
  return {
    text: "I can help with the property portfolio, registration, your dashboard, payments and reaching the team. Try one of these:",
    actions: quickActionsFor(context)
  };
}

function loadStored() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.messages) || !parsed.messages.length) return null;
    return parsed.messages.slice(-MAX_TRANSCRIPT);
  } catch (_) {
    return null;
  }
}

export class Conversation {
  constructor(context, persona) {
    this.context = context;
    this.persona = persona;
    this.messages = loadStored() || [];
    if (!this.messages.length) {
      this.messages.push({
        role: "assistant",
        text: greetingFor(context, persona),
        actions: quickActionsFor(context)
      });
      this.save();
    }
  }

  save() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: this.messages.slice(-MAX_TRANSCRIPT) }));
    } catch (_) {
      // Storage can be unavailable in private modes; the chat still works.
    }
  }

  reset() {
    this.messages = [];
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
    this.messages.push({
      role: "assistant",
      text: greetingFor(this.context, this.persona),
      actions: quickActionsFor(this.context)
    });
    this.save();
    return this.messages;
  }

  push(role, text, actions) {
    this.messages.push({ role, text, actions: actions || [] });
    if (this.messages.length > MAX_TRANSCRIPT) this.messages = this.messages.slice(-MAX_TRANSCRIPT);
    this.save();
  }

  setPersona(persona) {
    this.persona = persona;
  }

  async handle(text) {
    const input = String(text || "").trim();
    if (!input) return null;
    this.push("user", input);

    // Explicit request: "talk to Solomon", "bring Adaora back".
    const named = PERSONAS.find(persona =>
      persona.key !== this.persona.key && new RegExp(`\\b${persona.name}\\b`, "i").test(input)
    );
    if (named) {
      if (!canUse(named, this.context)) {
        const reply = {
          text: `${named.name} is not available in this session. I can still point you to the team or help with the portfolio.`,
          actions: contactActions(this.context)
        };
        this.push("assistant", reply.text, reply.actions);
        return reply;
      }
      const intro = named.key === "adaora"
        ? "Of course — I'll bring Adaora back to the conversation."
        : handoverIntro(named);
      this.push("assistant", intro, []);
      this.context.lastIntent = "persona";
      this.context.lastPersona = named.key;
      return {
        text: intro,
        actions: [],
        handover: { key: named.key, greeting: named.greeting, reply: null }
      };
    }

    const intent = INTENTS.find(rule => rule.test.test(input));
    if (intent && intent.handover && intent.handover !== this.persona.key) {
      const target = personaByKey(intent.handover);
      if (canUse(target, this.context)) {
        const intro = handoverIntro(target);
        this.push("assistant", intro, []);
        const specialistReply = await intent.reply(this.context);
        this.context.lastIntent = intent.key;
        this.context.lastPersona = target.key;
        return {
          text: intro,
          actions: [],
          handover: { key: target.key, greeting: target.greeting, reply: specialistReply }
        };
      }
    }

    const reply = intent ? await intent.reply(this.context) : fallback(this.context);
    this.context.lastIntent = intent ? intent.key : "fallback";
    this.push("assistant", reply.text, reply.actions);
    return reply;
  }
}

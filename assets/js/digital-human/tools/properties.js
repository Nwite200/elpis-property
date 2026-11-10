// Phase 7 property intelligence. Reads the live published catalogue through the
// existing public/scoped endpoint; never invents listings, prices or locations.

const LOCATIONS = [
  "Port Harcourt", "Benin City", "Victoria Island", "Abuja", "Lagos", "Benin", "Enugu", "Ibadan",
  "Kano", "Kaduna", "Asaba", "Uyo", "Owerri", "Jos", "Nyanya", "Lekki", "Ikeja", "Ajah",
  "Gwarinpa", "Wuse", "Maitama", "Kubwa", "Lugbe", "Karu", "Yaba", "Surulere", "Ikoyi"
];
const TYPES = ["duplex", "apartment", "terrace", "bungalow", "land", "plot", "commercial", "shop", "office", "flat", "mansion"];

const NGN = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
const money = value => NGN.format(Number(value || 0));

function parseBudget(text) {
  if (!text) return null;
  const withUnit = text.match(/\b([\d,]+(?:\.\d+)?)\s*(million|m|k|thousand)\b/i);
  const withCurrency = text.match(/(?:₦|ngn|naira|budget|under|below|less than|max(?:imum)?|up to|around)\s*(?:₦|ngn|naira)?\s*([\d,]+(?:\.\d+)?)\s*(million|m|k|thousand)?/i);
  const match = withUnit || withCurrency;
  if (!match) return null;
  const value = Number(String(match[1]).replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = String(match[2] || "").toLowerCase();
  if (unit === "million" || unit === "m") return value * 1000000;
  if (unit === "thousand" || unit === "k") return value * 1000;
  return value >= 100000 ? value : null;
}

function parseBedrooms(text) {
  const match = String(text || "").match(/(\d+)\s*(?:\+?\s*)?(?:bed|bedroom|bedrooms|br)\b/i);
  return match ? Number(match[1]) : null;
}

function parseLocation(text) {
  const lower = String(text || "").toLowerCase();
  const found = LOCATIONS.find(location => lower.includes(location.toLowerCase()));
  return found || null;
}

function parseType(text) {
  const lower = String(text || "").toLowerCase();
  return TYPES.find(type => lower.includes(type)) || null;
}

export function parsePropertyFilters(text) {
  return {
    budget: parseBudget(text),
    bedrooms: parseBedrooms(text),
    location: parseLocation(text),
    type: parseType(text),
    rental: /\b(rent|rental|lease|leasing|tenant)\b/i.test(text || "")
  };
}

function propertyLine(property, index) {
  const parts = [property.title];
  if (property.bedrooms) parts.push(`${property.bedrooms} bed`);
  const place = [property.city, property.state].filter(Boolean).join(", ");
  if (place) parts.push(place);
  parts.push(money(property.sale_price));
  return `${index + 1}. ${parts.join(" — ")}`;
}

export function propertyActions(properties, context) {
  const actions = properties.slice(0, 3).map((property, index) => ({
    label: `View property ${index + 1}`,
    href: `property-details.html?id=${encodeURIComponent(property.id)}`
  }));
  actions.push({ label: "See the full portfolio", href: context.isStaff ? "properties.html" : "index.html#properties" });
  return actions;
}

export async function searchProperties(context, text) {
  const filters = parsePropertyFilters(text);
  const params = new URLSearchParams({ limit: "50", status: "Available", is_published: "1" });
  if (filters.type) params.set("q", filters.type);

  let payload;
  try {
    const res = await fetch(`/api/properties?${params.toString()}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });
    if (!res.ok) return { text: "I couldn't reach the live property catalogue just now. Please try again in a moment.", actions: [{ label: "Open portfolio", href: context.isStaff ? "properties.html" : "index.html#properties" }] };
    payload = await res.json();
  } catch (_) {
    return { text: "I couldn't reach the live property catalogue just now. Please try again in a moment.", actions: [{ label: "Open portfolio", href: context.isStaff ? "properties.html" : "index.html#properties" }] };
  }

  const all = Array.isArray(payload.properties) ? payload.properties : [];
  let matches = all.filter(property => property.status === "Available" || property.status === undefined);
  if (filters.location) {
    const needle = filters.location.toLowerCase();
    matches = matches.filter(property => `${property.city || ""} ${property.state || ""}`.toLowerCase().includes(needle));
  }
  if (filters.bedrooms) matches = matches.filter(property => Number(property.bedrooms || 0) >= filters.bedrooms);
  if (filters.budget) matches = matches.filter(property => Number(property.sale_price || 0) <= filters.budget);
  matches.sort((a, b) => Number(a.sale_price || 0) - Number(b.sale_price || 0));
  const top = matches.slice(0, 3);

  if (filters.rental) {
    return {
      text: "Rental and sale listings are not separated in the live catalogue yet, so I won't guess which properties are for rent. I can show the available published properties, or the team can confirm rental options for you.",
      actions: [
        { label: "See available properties", href: context.isStaff ? "properties.html" : "index.html#properties" },
        { label: "Ask the team", href: "index.html#contact" }
      ],
      results: top
    };
  }

  if (!top.length) {
    const bits = [];
    if (filters.location) bits.push(`in ${filters.location}`);
    if (filters.bedrooms) bits.push(`with ${filters.bedrooms}+ bedrooms`);
    if (filters.budget) bits.push(`up to ${money(filters.budget)}`);
    return {
      text: `I found no published properties ${bits.join(" ")}. The live catalogue has ${Number(payload.total || all.length)} available listing(s); try a higher budget, another location, or ask the team.`,
      actions: [
        { label: "See available properties", href: context.isStaff ? "properties.html" : "index.html#properties" },
        { label: "Ask the team", href: "index.html#contact" }
      ],
      results: []
    };
  }

  const qualifier = filters.location ? ` in ${filters.location}` : "";
  const intro = `I found ${top.length} available ${top.length === 1 ? "property" : "properties"}${qualifier}${filters.budget ? ` up to ${money(filters.budget)}` : ""}.`;
  return {
    text: `${intro} ${top.map(propertyLine).join(" ")}`,
    actions: propertyActions(top, context),
    results: top
  };
}

export function compareProperties(context) {
  const list = Array.isArray(context.lastProperties) ? context.lastProperties.slice(0, 3) : [];
  if (!list.length) {
    return {
      text: "I haven't searched the catalogue in this conversation yet. Tell me a location, budget or property type and I'll pull real listings to compare.",
      actions: [{ label: "See the portfolio", href: context.isStaff ? "properties.html" : "index.html#properties" }]
    };
  }
  const rows = list.map((property, index) => {
    const place = [property.city, property.state].filter(Boolean).join(", ") || "Location on request";
    return `${index + 1}. ${property.title} — ${money(property.sale_price)}, ${property.bedrooms ? `${property.bedrooms} bed, ` : ""}${place}, ${property.status || "Available"}`;
  });
  return {
    text: `Here is the comparison from the live catalogue: ${rows.join(" ")}`,
    actions: propertyActions(list, context),
    results: list
  };
}

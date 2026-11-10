// Form awareness for Phase 6. Reads HTML5 validity and visible state only.
// Never reads password values, never claims success before the backend does.

const SKIP_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "file"]);
const KNOWN_LABELS = {
  fullName: "full name",
  email: "email address",
  phone: "phone number",
  alternatePhone: "alternate phone",
  residentialAddress: "residential address",
  state: "state",
  city: "city",
  branch: "branch",
  password: "password",
  confirmPassword: "password confirmation",
  curPass: "current password",
  newPass: "new password",
  confirmPass: "password confirmation",
  profName: "full name",
  profEmail: "email address",
  profPhone: "phone number",
  profAddress: "residential address",
  profCity: "city",
  profState: "state",
  profNok: "next of kin",
  contactFullName: "full name",
  contactPhoneInput: "phone number",
  contactEmailInput: "email address",
  contactMessage: "message",
  message: "message",
  nokName: "next of kin name",
  nokPhone: "next of kin phone",
  nokRelationship: "next of kin relationship",
  identityNumber: "identity number",
  bvn: "BVN"
};

function visible(element) {
  if (!element) return false;
  if (element.hidden) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

function labelFor(field) {
  if (field.id && KNOWN_LABELS[field.id]) return KNOWN_LABELS[field.id];
  const id = field.id;
  if (id) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label && label.textContent.trim()) return label.textContent.trim().replace(/\s+/g, " ").toLowerCase();
    } catch (_) { /* ignore */ }
  }
  const aria = field.getAttribute("aria-label");
  if (aria) return aria.trim().toLowerCase();
  const placeholder = field.getAttribute("placeholder");
  if (placeholder) return placeholder.trim().replace(/\s+/g, " ").toLowerCase();
  const name = field.getAttribute("name") || field.id || "";
  return name ? name.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase() : "this field";
}

function fieldsOf(form) {
  return Array.from(form.elements || []).filter(field => {
    if (!field || !field.tagName) return false;
    if (SKIP_TYPES.has(String(field.type || "").toLowerCase())) return false;
    if (field.disabled || field.readOnly) return false;
    return visible(field);
  });
}

function score(form) {
  return fieldsOf(form).filter(field => field.required).length * 10 + fieldsOf(form).length;
}

export function activeForm() {
  const forms = Array.from(document.forms || []).filter(visible);
  if (!forms.length) return null;
  return forms.sort((a, b) => score(b) - score(a))[0];
}

export function hasVisibleForm() {
  return !!activeForm();
}

function issueFor(field) {
  if (!field.willValidate) return null;
  const validity = field.validity;
  if (!validity || validity.valid) return null;
  const label = labelFor(field);
  if (validity.valueMissing) return `${label} is missing.`;
  if (validity.typeMismatch && field.type === "email") return `${label} doesn't look like a valid email address.`;
  if (validity.typeMismatch) return `${label} doesn't look like a valid ${field.type}.`;
  if (validity.patternMismatch) return `${label} doesn't match the expected format.`;
  if (validity.tooShort) return `${label} is shorter than the required length.`;
  if (validity.tooLong) return `${label} is too long.`;
  if (validity.badInput) return `${label} contains an invalid value.`;
  return `${label} needs attention.`;
}

export function checkForm() {
  const form = activeForm();
  if (!form) return { ok: false, found: false, text: "I don't see a form on this page." };
  const issues = [];
  const seen = new Set();
  for (const field of fieldsOf(form)) {
    const issue = issueFor(field);
    if (!issue || seen.has(issue)) continue;
    seen.add(issue);
    issues.push(issue);
    if (issues.length >= 3) break;
  }
  if (!issues.length) {
    return {
      ok: true,
      found: true,
      text: "This form looks complete. Review it once more, then submit when you're ready. I can't confirm it was accepted until the system responds."
    };
  }
  return {
    ok: false,
    found: true,
    issues,
    text: `A few things to check: ${issues.join(" ")} Fix those and I'll check again.`
  };
}

export function watchFormAttempts(onIssue) {
  let firstInvalid = null;
  let timer = null;
  let lastKey = "";
  let lastAt = 0;

  const onInvalid = event => {
    if (!firstInvalid) firstInvalid = event.target;
    if (timer) return;
    timer = window.setTimeout(() => {
      const field = firstInvalid;
      firstInvalid = null;
      timer = null;
      if (!field) return;
      const issue = issueFor(field);
      if (!issue) return;
      const key = `${field.id || field.name || field.type}:${issue}`;
      const now = Date.now();
      if (key === lastKey && now - lastAt < 8000) return;
      lastKey = key;
      lastAt = now;
      onIssue && onIssue(issue);
    }, 80);
  };

  document.addEventListener("invalid", onInvalid, true);
  return () => {
    document.removeEventListener("invalid", onInvalid, true);
    if (timer) window.clearTimeout(timer);
  };
}

# Digital Human Ecosystem — Phase 1 Audit

Date: 2026-11-10 · Scope: repository + infrastructure audit before implementation.
Status: **no assistant code shipped yet**; this document is the Phase 1 deliverable and the
implementation contract for Phases 2–11.

---

## 1. What the platform is today

| Layer | Reality |
|---|---|
| Frontend | 43 static HTML pages, vanilla ES modules, no framework/bundler. Shared scripts: `motion.js` (43 pages), `pwa.js` (42), `staff-shell.js` (20), `components.js` (10). Design tokens live in `assets/css/styles.css` (`--brand-primary #071747`, `--brand-secondary #E8B52D`, DM Sans + Cormorant Garamond). |
| Worker | One Cloudflare Worker (`src/index.js`, ~790 KB) with ~96 exact `/api` routes + parameterised handlers. Security headers, CSP, `Server-Timing` on every response. |
| Data | D1 SQLite: 79 tables, 164 indexes. R2 for documents/receipts, KV `CACHE`, Queue `TASKS`, Durable Object `ChatRoom`. |
| Auth | `ELPIS_session` cookie → `sessions` table → `getSessionUser` on every request. 13 roles; Super Admin inherits MD business scope; scoping via `clientScopeSql`, `leadScopeSql`, `commissionScopeSql`, `resolvePhase6Scope`. |
| Notifications | `notifications` + `notification_deliveries` + `notification_dedupe`; `createNotification()` inserts in-app, writes a delivery row, then enqueues `TASKS` (`notification.created`). Email/WhatsApp adapters are not implemented. |
| Payments | ALATPay dynamic accounts + Wema/ALAT webhook (`POST /api/webhooks/wema-alat`), idempotent verification, `webhook_events`, `notifyPaymentVerified()` fans out to marketer/team lead/referrer + all Finance Officers. |
| Property data | `GET /api/properties` is public for published listings (auth adds scope). Filters: `q`, `category`, `location`, `status`, `branch`, `featured`, `is_published`, pagination. |
| Staff presence | **None.** Only `users.is_active`, `users.last_login_at` and `sessions.expires_at`. There is no heartbeat, online flag or availability table. |
| Chat | `/api/chat` + Durable Object `ChatRoom` (WebSocket), `chat_rooms/messages/members`. Staff-to-staff and MD→staff only. |
| Observability | Workers Logs, `Server-Timing`, no RUM/APM. |

Performance baseline and remaining wins: `PERFORMANCE_AUDIT.md`.

---

## 2. Integration points the assistant will use

| Need | Existing surface | Change required |
|---|---|---|
| Page context | `location.pathname`, `document.body.dataset`, `staff-shell.js` | none |
| Identity/role | `GET /api/me`, `GET /api/client/dashboard` | none |
| Property search | `GET /api/properties?q&location&status&category&limit` | none (read-only) |
| Enquiries / viewings | `POST /api/public/enquiries` (`acquisition_mode: inspection`) | none |
| Client requests | `GET/POST /api/client/property-requests` | none |
| Staff notifications | `GET /api/staff/notifications` | add optional `since_id` (additive, shape unchanged) |
| Client notifications | `GET /api/client/notifications` | add optional `since_id` |
| Payment events | `notifyPaymentVerified()` → `createNotification()` | add `voice` metadata flag, no schema break |
| Human handover | new tables + endpoints | yes, additive migration |
| Chat transcript | `chat_rooms/messages` | reuse for handover, do not mix with assistant transcripts |
| Assets | Workers Static Assets + R2 | portraits as static WebP/AVIF in `assets/images/assistants/` |

No new Cloudflare binding is needed for Phases 2–9. KV can cache persona config or presence
heartbeats; the existing `CACHE` namespace is sufficient.

---

## 3. Proposed module layout (adapting the spec to this repo)

```
assets/js/digital-human/
  index.js                 # bootstrap, lazy mount after first paint
  config/personas.js       # 9 personas, voices, permissions, handover rules
  core/conversation.js     # ConversationManager + context store (in-memory + sessionStorage)
  core/router.js           # AgentRouter + intent matching (no LLM)
  core/context.js          # page/role/client/property/form context
  core/security.js         # allow-lists, confirmation gates, no direct privileged calls
  voice/engine.js          # capability detection, mute/stop/replay
  voice/recognition.js     # SpeechRecognition wrapper + permission states
  voice/synthesis.js       # SpeechSynthesis + voice profile selection
  ui/avatar.js             # portrait, idle/blink/speaking/listening/thinking states
  ui/panel.js              # conversation panel, captions, text input, controls
  ui/transitions.js        # persona crossfade/morph
  tools/properties.js      # read-only property search/compare
  tools/dashboard.js       # role-scoped summaries (calls existing APIs)
  tools/forms.js           # form awareness + validation parity
  tools/payments.js        # consumes notification events
  tools/handover.js        # staff lookup, request, accept/decline
  styles.css               # scoped `.elp-dh-*` classes, no global resets
```

Backend additions (additive migration `0033_assistant_handover.sql`):
- `assistant_handovers` — id, conversation_key, user_id, role, branch_id, persona_key, department,
  staff_user_id, status (`requested|accepted|declined|expired`), summary, context_json,
  requested_at, responded_at.
- `staff_presence` — user_id PK, last_seen_at, status (`available|busy|offline`), updated_at.
- Optional `assistant_events` — id, notification_id, user_id, spoken_at, channel, so a payment is
  announced once per device (dedupe by notification id).

No API response shape changes: new endpoints under `/api/assistant/*`; existing list endpoints gain
only optional query parameters.

---

## 4. Persona system

Personas are **configuration**, not code. Each entry:

```js
{
  key: "adaora",
  name: "Adaora",
  department: "Concierge",
  gender: "female",
  avatar: { idle, blink, speaking, listening, thinking }, // 5 frames or CSS states
  voice: { preferredNames: [...], lang: "en-NG", rate: 1.0, pitch: 1.05 },
  greeting: "Welcome to Elpis Property. I'm Adaora...",
  tools: ["navigate", "property.search", "form.guide", "handover"],
  handoverTo: ["solomon", "chiamaka", "emeka", "amara"],
  permissions: { public: true, staff: false, client: false }
}
```

Voice selection is heuristic: filter `speechSynthesis.getVoices()` by `lang` prefix, then by a
name allow-list per gender; if no match, use the closest locale and tell the user in captions that
the voice is a fallback. **Never** pitch-shift a female voice and label it male.

Nine personas: Adaora (concierge), Solomon (discovery), Chiamaka (sales), Emeka (rentals),
Amara (client relations), David (lead intelligence, staff), Ngozi (property management, staff),
Daniel (management, staff), Ifeoma (branch coordinator).

Staff-facing personas are only offered when `/api/me` returns a permitted role; their tools call
the same scoped endpoints as the dashboards, so a spoken request cannot exceed the user's rights.

---

## 5. Voice capability matrix (browser-native, free)

| Capability | Chrome desktop/Android | Edge | Safari (macOS/iOS) | Firefox |
|---|---|---|---|---|
| `SpeechRecognition` | yes | yes | partial / OS-dependent | no |
| `SpeechSynthesis` | yes | yes | yes (voices limited) | yes |
| Voice list (`getVoices`) | async, populated after `voiceschanged` | yes | yes, fewer | yes |
| Male/female metadata | no standard field | no | no | no |
| Autoplay speech without gesture | often blocked | blocked in some profiles | **blocked** | variable |

Fallback rules:
1. If recognition is missing or permission denied → typed input only, with a clear caption.
2. If synthesis is missing → captions only.
3. Audio never starts before a user gesture; a “Enable voice” control arms it.
4. All speech has a visible caption and a replay button.
5. Recognition requires HTTPS (the production domain satisfies this).

**Honest limitation:** browser recognition is not guaranteed offline, and voice quality/availability
depends on the OS. The assistant must say so in its capability message, not promise otherwise.

---

## 6. Avatar and lip-sync limitation

Initial implementation: a professional portrait per persona with CSS states — idle breathing,
periodic blink (two eye frames or overlay), a speaking ring/waveform, and a simple two-frame mouth
crossfade while `speechSynthesis` is speaking. This is approximate, not phoneme lip-sync, and must
not be described as real-time video or perfect lip-sync.

Avatars will be generated as consistent studio-style portraits (Nigerian professionals, brand
navy/gold wardrobe accents, neutral background) and stored as AVIF/WebP at 2× display size. No
cartoon, robot or toy styling.

---

## 7. Conversation, context and handover

- **One ConversationManager** owns transcript, persona, page context, selected properties, search
  preferences and form state. Handovers push a summary onto the same transcript; the user never
  repeats themselves.
- **AgentRouter** is deterministic: intent rules + slot filling, not an LLM. Unknown intent →
  “I can help with properties, your account, payments, or connect you to a person” plus buttons.
- **Persistence:** public chats stay in `sessionStorage`. Authenticated chats are persisted only when
  a human handover is requested (summary + transcript), with a retention window and no cross-user
  access. This avoids storing public PII without need.
- **Human handover:** new `assistant_handovers` row, notification to the selected staff member,
  status remains `requested` until the staff member accepts via an authenticated endpoint. The UI
  must never say “connecting you now” before `accepted`.
- **Availability:** with no presence system, the assistant can only rank staff by branch, role,
  `is_active` and `last_login_at`. Phase 9 adds a heartbeat (`staff_presence`) to make
  available/busy/offline honest.

---

## 8. Payment-aware announcements

Reuse the verified event path only:

1. Webhook verifies the transaction, updates `payments.status='verified'` idempotently, records
   `webhook_events`, then calls `notifyPaymentVerified()`.
2. `createNotification()` writes one row per recipient (dedupe + delivery record).
3. The assistant polls the existing notifications endpoint with `since_id`, announces **only**
   `type='payment.verified'` events addressed to the signed-in user, marks the local device as
   announced, and shows an in-app card with reference/amount.
4. Client virtual-account verification announces exactly: “Payment to ELPIS ACCESS successful. Your
   payment has been confirmed. Thank you for choosing Elpis Property.”
5. Pending/failed/reversed events never produce a success message; `since_id` + notification id
   prevent duplicates.

If audio is muted/unavailable or the tab is hidden, the card remains as an unread notification.

---

## 9. Security model

- The assistant is **not** an authorization layer. Every tool calls an existing endpoint with the
  user's cookie; the backend scopes the result.
- No privileged action from speech alone. Writes require an explicit on-screen confirmation, and
  irreversible actions are excluded from v1.
- Read-only tools for v1: property search, own dashboard/notifications, own profile summary,
  branch/staff lookup for handover. No payment mutation, no client edits, no commission actions.
- Never speak or display passwords, tokens, BVN, full identity numbers, or another customer's data.
- Transcripts are not sent to any third party. No OpenAI/Gemini/ElevenLabs calls.
- Add rate limiting on `/api/assistant/*` using the existing audit-log pattern.
- Audit every handover request/accept/decline and every assistant-initiated write.

---

## 10. Phased delivery (each phase ships behind `ASSISTANT_ENABLED`)

| Phase | Deliverable | Acceptance |
|---|---|---|
| 1 | This audit | reviewed |
| 2 | Floating launcher + panel + portrait avatar + captions, all pages, no voice | 1, 25, 26 |
| 3 | Free voice: recognition, synthesis, mute/stop/replay, typed fallback | 2, 3, 4, 25 |
| 4 | Personas, transitions, context continuity | 5–9 |
| 5 | Role/page greetings and scoped tools | 13–16 |
| 6 | Form awareness for signup/login/enquiry/profile | 10–12 |
| 7 | Property search/compare/viewing against `/api/properties` | 17 |
| 8 | Payment announcements via notifications | 18–21 |
| 9 | Human handover with `staff_presence` + accept workflow | 22–24 |
| 10 | Intro/voice branding, accessibility polish | 13 + a11y |
| 11 | Full test suite, staging deploy, compatibility report | all |

Flag: `ASSISTANT_ENABLED` in `wrangler.toml` (server) and a matching client constant. One-line
rollback: set to `"0"` — the script exits before mounting and no endpoint is reachable.

---

## 11. Performance guardrails

The assistant must not regress the work in `PERFORMANCE_AUDIT.md`:

- Script is `defer` + mounts on `requestIdleCallback` after first paint; no render-blocking CSS.
- Portraits lazy-loaded; only the active persona’s frames are fetched.
- Panel CSS is scoped and < 10 KB; no new font family.
- No polling faster than 15 s; pause when `document.hidden`.
- Measure LCP/INP before/after mounting on `/`, `/login`, `/dashboard`.

---

## 12. What cannot be delivered honestly under the free-only constraint

- Photorealistic real-time video avatars and true lip-sync.
- Unrestricted natural-language answers (no LLM); the assistant is intent-driven.
- Guaranteed speech recognition (browser/OS dependent), or offline recognition.
- Guaranteed male/female voice availability (voices are OS-provided; heuristics + fallback only).
- Licensed background music unless the owner supplies a licensed/CC0 track; no autoplay.
- True staff availability until a presence heartbeat exists (Phase 9).

Each limitation will be surfaced in the UI and in the final compatibility report rather than hidden.

---

## 13. Immediate next step

Phase 2 needs:
1. Approval to generate nine portrait assets (or owner-supplied photos).
2. Confirmation that v1 tools stay read-only + public enquiry/handover.
3. A decision on transcript retention for authenticated handovers (default: 90 days).

On approval I will implement Phase 2 behind `ASSISTANT_ENABLED`, add a Playwright acceptance test
for mount/visibility/keyboard/mobile, and keep every existing suite green.

---

## 14. Phase 2 status (shipped)

- Floating launcher + panel on 42 pages (all except `offline.html`), scoped styles, no new
  framework, no render-blocking CSS (stylesheet injected at runtime), mount delayed to idle.
- Adaora persona with page/role-aware greeting, typed conversation, deterministic intent routing,
  captions, keyboard support (`Escape`, focus return), reduced-motion support and mobile bottom-sheet
  layout.
- Conversation transcript persists per tab in `sessionStorage`; restart clears it.
- All replies are navigation/contact guidance with real links. No figures, listings, payments or
  staff records are invented.
- Rollback: `export const ENABLED = false` in `assets/js/digital-human/config.js`.

**Avatar limitation:** the image generator failed with “insufficient account funds”, so no
portrait was produced. The component renders a brand monogram (`A`) until
`assets/images/assistants/adaora.png` exists; dropping the file in place switches the avatar
automatically (same for the other eight personas). This must be completed before Phase 4 is
called done.

**Tests:** 183 total, including three new browser checks (loader on every page, typed conversation
with Escape/focus, mobile viewport fit).

## 15. Phase 3 status (voice)

- Free, browser-native voice only: `SpeechRecognition`/`webkitSpeechRecognition` for input and
  `SpeechSynthesis` for output. No API keys, no paid services, no audio leaves the browser through us.
- Voice is **off by default**; nothing speaks before a user gesture. The speaker control enables it,
  the microphone control starts one-shot recognition, and Stop cancels both.
- Male/female voice selection is a documented heuristic over locale + common voice names (voices
  carry no gender field). If no match exists the device default is used and the status says so.
- Controls: mic, Voice on/off, Stop, Replay; live status for listening, interim transcript,
  speaking, permission denial, missing microphone, network/speech-service errors and unsupported
  browsers. Captions/transcript remain the source of truth.
- Recognised final speech is inserted as the user message and answered exactly like typed input;
  text remains available in every state.
- Speech input may require a connection (browser service) and is not guaranteed offline; the UI
  states this through its error/status copy and the compatibility report.

**Avatar:** generation failed again with “Insufficient account funds”. The monogram fallback is
live; add `assets/images/assistants/adaora.png` to switch automatically.

**Tests:** 185 total; browser suite now covers unsupported-browser fallback and a stubbed
speak/replay/stop/spoken-transcript flow.

## 16. Phase 4 status (personas + entry introduction)

- **Portraits:** Adaora and Solomon use the owner-supplied portraits (320×320 JPEG, self-hosted).
  Chiamaka, Emeka, Amara and the staff personas keep the monogram fallback until portraits are
  supplied; no face is reused for two names.
- **Entry introduction:** on the landing page and any dashboard (staff, finance, sub-admin, GSM,
  accountant, super-admin, client) a compact bubble introduces Adaora with a role-aware greeting,
  once per browser session for each entry type (landing and dashboards independently). It can open the panel, speak the greeting through an explicit button,
  or be dismissed. It never blocks the launcher or page controls.
- **Personas:** Adaora (concierge), Solomon (property discovery), Chiamaka (sales), Emeka
  (rentals), Amara (client relations) are live for their authorised audiences. David, Ngozi,
  Daniel and Ifeoma remain staff-only and unavailable until Phase 9.
- **Transformation:** handover crossfades the portrait, updates name/department, changes the voice
  profile (female/male heuristic), and appends the specialist greeting. The transcript, context,
  page and role are preserved; users can name a specialist directly (“talk to Solomon”) or ask to
  return to Adaora.
- **Routing:** property/viewing → Solomon; sales → Chiamaka; rentals → Emeka; complaints/care →
  Amara (client/staff); unknown intents stay with the current persona. No privileged action and no
  fabricated property or payment data.
- **Voice:** persona change updates the synthesis profile and resets the chosen voice; a handover
  speaks the specialist greeting and reply only when voice was already enabled by the user.

**Tests:** 188 total; browser suite adds entry-introduction, once-per-session, dashboard greeting,
persona handover/context continuity and male-voice selection after handover.

## 17. Phase 5 status (dashboard intelligence)

- **Portraits:** all nine personas now use the owner-supplied studio portraits (320×320 JPEG,
  self-hosted). The four portraits from the second grid cover Chiamaka, Amara, Ngozi, Ifeoma,
  Emeka, David and Daniel; no face is reused.
- **Role-aware greetings:** client, marketer, finance/account officer, team lead, manager,
  administrator, customer care and GSM groups each get their own dashboard greeting and intro
  bubble text. Clean URLs (`/dashboard`, `/client-dashboard`) are normalised before matching, so
  the introduction works in production routing as well as `.html` paths.
- **Authorised summaries:** “summary / status / balance / what’s pending” calls the existing
  read-only endpoint for the role and reads real figures:
  - client → `/api/client/dashboard` (agreed price, verified, outstanding, next installment)
  - finance → `/api/finance/overview` (today, month, pending, outstanding balances)
  - accountant → `/api/accountant/earnings` (collected, pending, outstanding, settlement)
  - admin → `/api/admin/overview` (staff, clients, audit count)
  - care → `/api/customer-care/overview` (clearance queue and calls)
  - marketer / team lead / manager → `/api/dashboard` scoped by the backend
- **Safety:** the tool only reads; the server enforces role and branch scope. On 401/403 it explains
  the limit instead of showing data. No figure is ever invented or cached.
- **Quick actions:** each role gets links to the workspaces it can already open.

**Tests:** 191 total; browser suite adds role-aware greetings (marketer, finance, super admin),
a real client balance summary, and a portrait-file check for all nine personas.

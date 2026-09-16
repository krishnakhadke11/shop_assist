# Shop Assist — Phase 1 Implementation TODO

Generated from gap analysis against `shopassist-ui-plan.md` and `shopassist-risk-register.md`.

---

## Phase A — Shell (Week 1) — *Mostly Complete*

- [x] Design tokens (brand green, amber, error, ink, accent) — `tailwind.config.js`
- [x] Devanagari type scale (Noto Sans Devanagari / Mukta + Inter) — test mixed strings
- [x] Three-tab bottom nav (Home · Orders · Profile) — `src/app/layout.tsx`
- [x] Routing (App Router)
- [x] Auth screens: `/auth/phone`, `/auth/otp` (mock OTP)
- [x] Merchant card component — `src/app/page.tsx`
- [x] Call button component — `src/components/CallButton.tsx`
- [ ] **Fix:** Call button — add visible text label (per §6, L-12), replace mic icon with phone icon
- [ ] **Fix:** Merchant card — remove star rating & like button (per §10)
- [ ] **Fix:** Merchant card — add AI agent status indicator (online/offline)
- [ ] Device location + pincode filtering (wired but unused — `filteredMerchants` needs real distance)

---

## Phase B — Core Flow (Week 2)

### `/category/:slug` — Category Merchant List
- [ ] Route: `src/app/category/[slug]/page.tsx`
- [ ] Search within category, filter by open-now & distance
- [ ] Reuse merchant card from Home

### `/merchant/:id` — Merchant Detail
- [ ] Route: `src/app/merchant/[id]/page.tsx`
- [ ] Hero: real photo or typographic placeholder (initial on tinted block)
- [ ] Name, category, address, distance
- [ ] Open/closed with today's hours (M-07)
- [ ] Persistent Call button (fixed bottom, 56px min, text label)
- [ ] "Your past orders with this shop" section (L-15)
- [ ] Known items list (read-only)
- [ ] AI agent status indicator

### `/call/:orderId` — Live Call Screen (Phase 1: Customer AI Capture)
- [ ] **Route change:** `/call/[merchantId]` → `/call/[orderId]` (orderId in URL per §2)
- [ ] Layout:
  - [ ] Shop name + call-duration timer
  - [ ] Phase badge: "Your AI assistant"
  - [ ] Live order list (items appear as captured)
  - [ ] Per-item: quantity (dominant), name, unit
  - [ ] Low-confidence items: amber left border + "check this" label
  - [ ] Persistent hint: "Say it again if something looks wrong"
  - [ ] End-call button (visible in phase 1 only)
- [ ] Quantity visually dominant (larger type, own left column) — L-06
- [ ] Voice-only correction (no tap-to-edit) — §5.6
- [ ] Screen wake lock during call
- [ ] Polling at 1.5s during `placing`

### Order State Machine Components
- [ ] State chip component (7 states: placing, captured, pending, confirmed, modified, rejected, unreachable)
- [ ] Diff rendering for `modified` (highlight changed fields)
- [ ] Skeleton price slot for `pending`/`captured` (no price before confirmed — B-01)

---

## Phase C — AI-to-AI Handoff (Week 3)

### Decision 6: Handoff Mechanism (Must Decide First)
- [ ] **Option A:** LiveKit room transfer (customer AI → merchant AI in same/sibling room)
- [ ] **Option B:** API bridge (customer AI writes order → event → merchant AI polls/consumes → writes result)

### Decision 7: Merchant AI Scope (Must Decide)
- [ ] **Minimal:** Confirm/reject + price only, escalate complex to human
- [ ] **Full:** Substitute items, edit quantities, suggest alternatives (needs inventory/alias data)

### `/call/:orderId` — Live Call Screen (Phase 2: Merchant AI Review)
- [ ] Phase badge: "Merchant AI reviewing"
- [ ] Live updates as merchant AI confirms/edits/rejects
- [ ] Merchant AI edits: amber "merchant AI changed" badge + diff highlight
- [ ] Hide end-call button during phase 2
- [ ] Polling at 3s during `pending`

### Merchant AI Agent (`apps/agents`)
- [ ] Separate LiveKit agent (or worker) for merchant side
- [ ] Receives handoff with order context (customer transcript, items, quantities)
- [ ] Inventory/pricing lookup (deterministic, not LLM inference — L-05, D-05)
- [ ] Confirm / edit price / substitute / reject
- [ ] Write result back via handoff mechanism
- [ ] Human-in-the-loop for first N orders per merchant (B-09)

### AI-to-AI Handoff Implementation
- [ ] Persistent order ID created at `placing` start
- [ ] Idempotent handoff with acknowledgement
- [ ] Customer AI retains ownership until merchant AI ACKs
- [ ] Timeout handling: >60s → escalate to SMS/human fallback (B-11)
- [ ] Dead letter queue + alerting for failed handoffs (B-10)

### Orders API (Backend)
- [ ] `GET /orders/active` → array of active orders
- [ ] `GET /orders/:id` → full order with state, items, price?, eta?, changes?
- [ ] Order model: state machine, items[{name, qty, unit, confidence, changed?}], price, eta, changes[{field, from, to}], created_at, updated_at
- [ ] Transactional outbox for notifications (S-05)

### Polling & Timers
- [ ] Tiered backoff hook: 1.5s (placing) → 3s (pending) → 3s (first 30s) → 10s → 30s → stop at 10min
- [ ] Single `GET /orders/active` poll for all active orders
- [ ] Page Visibility API: stop on background, reset to fast tier on foreground
- [ ] Elapsed time from server `created_at` (not client counter)

### Orders List (`/orders`)
- [ ] Active orders pinned at top with live state chips + elapsed timers
- [ ] Past orders below, grouped by date
- [ ] Card: shop name · state chip · item count · price (only confirmed/modified) · timer

### Order Detail (`/orders/:id`)
- [ ] Full state machine surface per §4
- [ ] Common: shop name, callable number, item list with quantities, timestamp, order ID
- [ ] State-specific rendering (pending: skeleton price + timer; confirmed: price/ETA; modified: diff first; rejected: reason + alternatives; unreachable: shop direct number)
- [ ] Re-order button on terminal states

---

## Phase D — Edges (Week 4)

### Empty States (Majority experience at 5 merchants — §9)
- [ ] No merchants in category → "not live in your area yet" + notify-me + live categories
- [ ] No merchants in pincode → capture pincode as demand signal (B-07) — `reportEmptyLocationDemand()`
- [ ] No orders yet → point at categories with clear action
- [ ] No past orders with merchant → hide section entirely

### Error States
- [ ] Call failed / network lost / order not found / session expired / OTP failure
- [ ] **Every call-related error offers shop's real phone number** as escape hatch (§9)

### Notifications
- [ ] In-app banner (tab open)
- [ ] Web Push (permission after first successful order + PWA install prompt)
- [ ] SMS (floor — copy: shop name, item count, price, state, language, ≤160 chars)
- [ ] Merchant AI delayed (>2min) → SMS with fallback to call shop directly

### Profile (`/profile`)
- [ ] Verified number (display only, change via re-verification)
- [ ] Delivery addresses
- [ ] Preferred language (feeds L-03 for first-call greeting)
- [ ] Notification permissions
- [ ] Logout

### Reorder Strip (Home)
- [ ] Last 3 merchants ordered from, one tap to call (E-02)

---

## Backend — Core Infrastructure (Parallel Track)

- [ ] Real auth: OTP via SMS provider, JWT sessions, refresh tokens
- [ ] Merchant model: inventory/pricing, AI agent config (LiveKit URL, agent identity), hours
- [ ] Customer model: internal ID (not phone — D-01), phone numbers with provenance (D-02), language, addresses
- [ ] Order model + state machine transitions (guarded — S-08)
- [ ] Notification outbox + idempotency keys + reconciliation sweep (S-05)
- [ ] Escalation ladder: WhatsApp → 60s retry → SMS at 3min → voice call at 5min → reassign (S-06)
- [ ] LiveKit webhook endpoints (room events, participant events)
- [ ] Per-call trace with turn-level latency (ASR/LLM/TTS/network) — S-11
- [ ] Redis: merchant config cache, session state (TTL for resume-on-redial — S-09)

---

## Agents — Order-Taking Logic (Parallel Track)

### Customer AI Tools
- [ ] `add_item(name, qty_raw, unit, confidence)`
- [ ] `update_quantity(item_index, qty_raw, confidence)`
- [ ] `remove_item(item_index)`
- [ ] `finalize_order()` → triggers handoff

### Quantity Normalization (L-05)
- [ ] Deterministic table: pav=0.25, adha=0.5, pauna=0.75, sawa=1.25, dedh=1.5, dhai=2.5, tola=11.66g
- [ ] Unit aliases: packet/pouch/dabba → per-product mapping
- [ ] Unresolved tokens flagged for merchant confirmation (not guessed)

### Alias/Category Table (D-07, D-08)
- [ ] Editable by non-engineers without deploy (JSON/DB + admin UI or CLI)
- [ ] Regional variants: doodh/dudh/milk, atta/aata/gehun ka atta, etc.
- [ ] Brand aliases: Colgate→toothpaste, Surf→detergent, Maggi→noodles (with brand_is_specific flag)

### Language Handling (L-03, L-04, L-16)
- [ ] Per-merchant default language from onboarding
- [ ] Runtime language detection on first utterance + hysteresis
- [ ] Per-language eval suites in CI (L-16)

### Observability
- [ ] Store audio + transcript + extracted order + merchant-corrected order per call (B-06, S-11)

---

## Pre-Launch Gates (Risk Register §11) — **Blocking**

### Before Further App Code
- [ ] Carrier matrix test: Jio/Airtel/Vi × forwarded/direct/withheld/landline (T-02)
- [ ] 200 real order calls recorded with consent (eval corpus) (L-01, B-06)
- [ ] ASR candidates benchmarked on corpus at telephony bandwidth (L-11)
- [ ] Missed-call baseline measured in ≥5 shops (B-03)
- [ ] Vendor concurrency ceilings documented in writing (S-02)

### Before First Live Merchant
- [ ] `From == merchant number` guard implemented (T-02)
- [ ] Two-phase confirmation enforced; agent cannot assert price/availability (B-01)
- [ ] Quantity normalization table deterministic + unresolved-token flagging (L-05)
- [ ] Transactional outbox + idempotency keys on notifications (S-05)
- [ ] Escalation ladder live (S-06)
- [ ] Fallback TwiML on webhook failure (T-06)
- [ ] AI disclosure in greeting per language (M-05)
- [ ] Recording consent announcement (C-07)
- [ ] Customer entity keyed on internal ID, not phone (D-01)
- [ ] Per-call trace with turn-level latency breakdown (S-11)
- [ ] Forwarding-health alert (calls/merchant/week → 0) (T-04)

---

## Tooling & Quality

- [ ] Fix Jest config: `setupFilesAfterSetup` → `setupFilesAfterEnv`, install `ts-jest`, `jest-environment-jsdom`, `@types/jest`
- [ ] Add PWA manifest + service worker (iOS push requirement)
- [ ] SMS provider integration (Twilio/Plivo/Exotel for notification floor)
- [ ] CI: typecheck (`npx tsc --noEmit`), lint, per-language eval gate (L-16)

---

## Open Decisions Requiring Product/Engineering Alignment

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Customer call transport | WebRTC primary, PSTN fallback | WebRTC (live order screen works on mobile) |
| 6 | AI-to-AI handoff | A: LiveKit room transfer / B: API bridge | **Start with B** (decoupled, faster iteration) |
| 7 | Merchant AI scope | Minimal (confirm/reject) / Full (edit/substitute) | **Start with Minimal** + human escalation |
| 3 | Voice-only vs tap correction | Voice only (MVP) | Voice only — tap creates state conflicts |
| 5 | Language toggle | Profile only / per-call | Profile only for MVP |

---

## File & Directory Structure (Target)

```
apps/frontend/
├── src/
│   ├── app/
│   │   ├── category/[slug]/page.tsx        ← NEW
│   │   ├── merchant/[id]/page.tsx          ← NEW
│   │   ├── call/[orderId]/page.tsx         ← RENAME from [merchantId]
│   │   ├── orders/page.tsx                 ← NEW
│   │   ├── orders/[id]/page.tsx            ← NEW
│   │   ├── profile/page.tsx                ← NEW
│   │   ├── api/
│   │   │   ├── auth/                       ← REPLACE mock with real
│   │   │   ├── orders/                     ← NEW
│   │   │   ├── merchants/                  ← NEW
│   │   │   ├── livekit/token/route.ts      ← UPDATE for orderId + auth
│   │   │   └── notifications/              ← NEW (Web Push, PWA)
│   ├── components/
│   │   ├── CallButton.tsx                  ← FIX: text label, phone icon
│   │   ├── CallScreen.tsx                  ← REWRITE: two-phase
│   │   ├── MerchantCard.tsx                ← EXTRACT from page.tsx
│   │   ├── OrderStateChip.tsx              ← NEW
│   │   ├── OrderDiff.tsx                   ← NEW
│   │   ├── OrderSkeleton.tsx               ← NEW
│   │   ├── PhaseBadge.tsx                  ← NEW
│   │   ├── EmptyStates/*.tsx               ← NEW
│   │   └── ErrorBoundary.tsx               ← NEW
│   ├── lib/
│   │   ├── useTieredPolling.ts             ← NEW
│   │   ├── useWakeLock.ts                  ← NEW
│   │   ├── quantityNormalization.ts        ← NEW (L-05 table)
│   │   └── orderStateMachine.ts            ← NEW
│   └── hooks/
│       └── useOrders.ts                    ← NEW

apps/backend/
├── app/
│   ├── api/v1/
│   │   ├── orders.py                       ← NEW
│   │   ├── merchants.py                    ← NEW
│   │   ├── customers.py                    ← NEW
│   │   ├── notifications.py                ← NEW
│   │   └── webhooks/
│   │       ├── livekit.py                  ← NEW
│   │       └── twilio.py                   ← FALLBACK
│   ├── models/
│   │   ├── order.py                        ← NEW (state machine)
│   │   ├── merchant.py                     ← NEW
│   │   ├── customer.py                     ← NEW (internal ID, phone provenance)
│   │   └── notification_outbox.py          ← NEW (S-05)
│   └── services/
│       ├── order_state_machine.py          ← NEW (guarded transitions)
│       ├── notification_dispatcher.py      ← NEW (outbox + escalation)
│       └── ai_handoff.py                   ← NEW (Decision 6 impl)

apps/agents/
├── src/agents/
│   ├── voice/
│   │   ├── livekit_agent.py                ← REFACTOR: customer AI tools
│   │   ├── merchant_agent.py               ← NEW (merchant AI)
│   │   └── handoff.py                      ← NEW (Decision 6)
│   ├── tools/
│   │   ├── order_tools.py                  ← NEW (add_item, etc.)
│   │   ├── quantity_normalizer.py          ← NEW (L-05 table)
│   │   └── alias_resolver.py               ← NEW (D-07)
│   └── config.py                           ← ADD: merchant AI config
```

---

## Notes

- **Phase B & C can run in parallel** — frontend screens vs backend/agents
- **Decisions 6 & 7 must be resolved before Phase C starts** — they define the contract
- **Pre-launch gates are hard blockers** — do not skip carrier matrix or eval corpus
- **Empty/error states are not polish** — they're the majority experience at launch (§11)
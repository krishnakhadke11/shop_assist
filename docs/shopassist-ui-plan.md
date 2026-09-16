# ShopAssist — Customer Web App UI Plan

**Scope:** Customer-facing responsive web app (React). Merchant side is out of scope for this document — merchant operates via their own AI voice agent (LiveKit) that receives orders from the customer's AI and confirms/edits/rejects them.

**Visual reference:** BuListio listings app. Card rhythm, radius, spacing and coral accent are adopted. Its information architecture (claim-a-business, ratings, reviews, price ranges, bookmarks) is **not** — see [§10](#10-explicitly-not-building).

**Central premise:** this is not a browsing app with a call button attached. It is a **dialer with shops in it**. Every screen exists to get the customer onto a call fast, show them what the AI heard, and tell them honestly what the merchant's AI said back.

**Related:** risk IDs referenced throughout (B-01, L-06, M-01…) map to `shopassist-risk-register.md`.

---

## Contents

1. [What changed and why it matters](#1-what-changed-and-why-it-matters)
2. [Route map](#2-route-map)
3. [Design system](#3-design-system)
4. [Order state machine](#4-order-state-machine)
5. [Screen specifications](#5-screen-specifications)
6. [The call button](#6-the-call-button)
7. [Polling and data refresh](#7-polling-and-data-refresh)
8. [Notifications](#8-notifications)
9. [Empty, loading and error states](#9-empty-loading-and-error-states)
10. [Explicitly not building](#10-explicitly-not-building)
11. [Build sequence](#11-build-sequence)
12. [Open decisions](#12-open-decisions)

---

## 1. What changed and why it matters

Two decisions reshape the UI relative to the original plan.

### 1.1 OTP-verified customer identity removes T-02

The customer verifies their phone at signup. Identity is known **before** the call starts, so the app never depends on carrier caller-ID passthrough. This eliminates risk **T-02** (caller ID unreliable through forwarding) and makes **L-15** (*"wahi wala jo pichli baar liya tha"*) work from day one, because order history can be keyed reliably.

**UI consequence:** merchant detail screens carry a *"Your past orders here"* section. Repeat ordering is a first-class flow, not a nice-to-have — and per **E-02**, shorter calls are directly margin-positive.

### 1.3 AI-to-AI merchant confirmation (Phase 1)

The merchant no longer confirms orders via WhatsApp. Instead, each merchant runs their own AI voice agent on LiveKit. After the customer's AI captures the order, it hands off to the merchant's AI via a LiveKit room (or API bridge). The merchant's AI:
- Reviews the captured order against the merchant's inventory/pricing
- Confirms, edits (price, quantity, substitutions), or rejects
- Returns the final order state to the customer's AI

**UI consequence:** the live call screen (`/call/:orderId`) now shows two phases — customer capture (agent A) and merchant AI confirmation (agent B). The order renders live during both phases. The `pending` state represents "with merchant AI" rather than "with human merchant on WhatsApp."

### 1.2 Live order rendering during the call

The agent updates order state via tool calls mid-call. The browser is open during the call. Therefore **the order can render on screen as the customer speaks**.

Customer says *"do kilo atta"* → agent calls `add_item` → poll picks it up → **2 kg आटा** appears on screen → customer sees the error immediately if there is one.

This is the most valuable feature in the app. **L-06** identifies quantity errors as the highest-cost error class precisely because they look plausible and pass through unnoticed. Visual confirmation during capture is a far stronger mitigation than audio read-back, and it costs nothing extra — the screen and the tool calls both already exist.

**UI consequence:** `/call/:orderId` is the centrepiece screen. It has no equivalent in the reference.

> ⚠️ **This feature depends on transport.** On the PSTN/TwiML path on mobile, the customer is on a phone call, the browser is backgrounded, and the live order is invisible. See [§12](#12-open-decisions), Decision 1.

---

## 2. Route map

| Route | Screen | Auth | Notes |
|---|---|---|---|
| `/` | Landing / Home | Public → gated | Shows categories; call requires auth |
| `/auth/phone` | Phone entry | Public | |
| `/auth/otp` | OTP verification | Public | |
| `/category/:slug` | Merchant list | Required | |
| `/merchant/:id` | Merchant detail | Required | Primary call surface |
| `/call/:orderId` | Live call | Required | **Centrepiece** |
| `/orders` | Orders list | Required | Active + past |
| `/orders/:id` | Order detail | Required | State machine surface |
| `/profile` | Profile | Required | Number, addresses, language |

**Nine routes. Three-tab bottom nav:** Home · Orders · Profile.

The reference uses five tabs. Cut to three — **L-12** notes the target demographic is older and less app-fluent, and every additional tab is a decision they have to make.

**Deep-linkable:** `/orders/:id` and `/call/:orderId` carry the order ID in the URL so refresh and back-button work. The app is stateless; all state reconstructs from the server on load.

---

## 3. Design system

### 3.1 Typography — Devanagari first

Shop names, item names and quantities all render in Devanagari (Hindi, Marathi) alongside Latin brand names, frequently **in the same string**: *"2 kg आशीर्वाद आटा"*.

**Font stack:** Noto Sans Devanagari or Mukta for Devanagari, paired with Inter for Latin. Verify the pairing at the same optical size — mismatched x-heights in mixed strings look broken.

**The practical problem is not glyph coverage, it is vertical metrics.** Devanagari runs roughly 15–20% taller than Latin at the same point size, and above-line matras clip in tight line-heights.

| Rule | Value |
|---|---|
| Line height | ≥1.5 everywhere, ≥1.6 for lists |
| Body minimum | 16px |
| Actionable text | 18px |
| Shop names | Never truncate mid-word — cards grow, text does not clip |
| Testing | Every card tested with a long Marathi name **and** a short English one |

### 3.2 Colour

**Coral is reserved for one meaning: this places a call.**

In the reference, coral appears on "See All", on price text, and on the active nav pill — it is decoration. Strip it back. For a user who prefers phone calls *because* apps are unfamiliar, one unmissable affordance beats five accent placements.

| Token | Use |
|---|---|
| `--coral` | Call actions only. Nothing else. |
| `--ink` | Primary text |
| `--ink-muted` | Secondary text, labels |
| `--amber` | Low-confidence fields, needs-attention |
| `--green` | Confirmed states |
| `--surface` / `--surface-raised` | Backgrounds, cards |
| `--border` | Card and divider strokes |

Amber is load-bearing, not decorative: it marks unresolved quantity tokens (**L-05**) and unmatched item strings (**L-08**) so the customer's eye goes to the fields most likely to be wrong.

### 3.3 Layout

Mobile-first, single column to 640px, max content width 720px on desktop. Card radius, padding and shadow follow the reference. Touch targets minimum 48px, call buttons 56px. Navigation never nests deeper than two levels.

### 3.4 Imagery

**Drop the reference's illustration style entirely.** Vector illustrations of gyms and hospitals read as stock and generic. A neighbourhood kirana needs a real photograph or a clean typographic placeholder — shop initial on a tinted block. Never a stock illustration.

---

## 4. Order state machine

Every order surface renders from a single server-provided `state` field. The client switches on it; it does not derive state from combinations of booleans.

```
placing → captured → pending → ┬→ confirmed
                               ├→ modified
                               ├→ rejected
                               └→ unreachable
```

| State | Screen shows | Price? | Terminal |
|---|---|---|---|
| `placing` | Call live, order building in real time (customer AI) | No | No |
| `captured` | Full item list, "Sent to merchant AI" | **No** | No |
| `pending` | Item list + skeleton on price/ETA + elapsed timer (merchant AI reviewing) | **No** | No |
| `confirmed` | Items, quantities, **price**, ETA | Yes | Yes |
| `modified` | **Diff** — what the merchant AI changed, then final order | Yes | Yes |
| `rejected` | Reason + nearby alternatives in same category | No | Yes |
| `unreachable` | "Merchant AI hasn't responded" + fallback options | No | Yes |

### Two rules that cannot be relaxed

**No price before `confirmed`.** Per **B-01**, the merchant has no inventory system and prices the order themselves (via their AI). The app must never show, estimate, or imply a price before the merchant AI acts. The price slot shows a skeleton, never a number.

**`modified` must show a visible diff.** Merchant AI correction *is* the point of two-phase confirmation. `2 kg आटा` → `1 kg आटा` **(merchant AI changed)** must be legible at a glance, with the changed field highlighted. If `modified` looks like `confirmed`, the customer discovers the change at the door.

### API contract

```
GET /orders/active   → [Order]
GET /orders/:id      → Order

Order {
  order_id, merchant: {id, name, phone},
  state, items: [{name, qty, unit, confidence, changed?}],
  price?, eta?, changes?: [{field, from, to}],
  created_at, updated_at
}
```

`created_at` is server-supplied; **the client computes elapsed time from it.** This makes timers survive refresh, tab restore, and client clock skew.

---

## 5. Screen specifications

### 5.1 Auth — phone entry (`/auth/phone`)

Single field, Indian mobile format, country code fixed to +91 and non-editable. Large numeric keypad input. One-line explanation of why the number is needed: *the shop needs it to confirm your order*.

Consent line for order-related SMS, with purpose stated (**C-02**, **D-02** — provenance and purpose limitation are recorded server-side at this moment).

### 5.2 Auth — OTP (`/auth/otp`)

Six-digit input, auto-advance, paste support, `autocomplete="one-time-code"` for browser autofill. Resend after 30s with visible countdown. Change-number link back.

**Failure states:** wrong code, expired code, too many attempts (with cooldown), SMS not delivered (offer resend then voice-OTP fallback).

### 5.3 Home (`/`)

Structure follows the reference: search field, horizontal category row, merchant list below. Three changes:

- Location/pincode is shown and editable at the top — it drives everything below
- Merchant cards carry a **Call** button as primary action, not tap-to-detail
- **Reorder strip** above categories for returning customers: last 3 merchants ordered from, one tap to call

The reorder strip is the **E-02** margin feature made visible — a returning customer who calls a known shop produces a short call, and short calls are the difference between positive and negative contribution margin.

**Merchant card:** photo or initial block · name (Devanagari-safe, no truncation) · category · distance · open/closed · Call button.

No ratings. No review counts. No price range.

### 5.4 Category list (`/category/:slug`)

Reference's list layout, retained. Search within category, filter by open-now and distance. Same merchant card as Home.

### 5.5 Merchant detail (`/merchant/:id`)

Reference's detail layout, restructured:

1. Hero — real photo, or typographic placeholder
2. Name, category, address, distance
3. Open/closed with today's hours (**M-07**)
4. **Persistent Call button** — fixed to viewport bottom, does not scroll away
5. **Your past orders with this shop** — the section absent from the reference and the reason repeat ordering is fast (**L-15**)
6. Known items list, if the merchant has one — read-only, informational
7. **AI agent status** — indicator showing if the merchant's AI agent is online/available

No tabs (the reference has About/Features/Products/Reviews/FAQ). Single scroll. **L-12** — the demographic should not have to find content behind a tab.

### 5.6 Live call (`/call/:orderId`) — centrepiece

No equivalent in the reference. This is where the app earns its existence.

**Layout, top to bottom:**

- Shop name and call-duration timer
- **Phase indicator** — "Your AI assistant" / "Merchant AI reviewing" badges
- **Live order list**, items appearing as the agent captures them (phase 1), then updated as merchant AI confirms/edits (phase 2)
- Per-item: quantity (visually dominant), item name, unit
- Low-confidence items rendered with amber left border and a *"check this"* label
- Merchant AI edits highlighted with amber "merchant AI changed" badge
- Persistent hint: *"Say it again if something looks wrong"*
- End-call button (only during phase 1; hidden during phase 2)

**Quantity is the visually dominant field** — larger type than the item name, its own left column. Per **L-06** this is the highest-cost error class, and the register is explicit that quantity must not be rendered as a small grey subtitle.

**Two-phase flow:**
1. **Phase 1 — Customer AI capture** (`placing`): Customer speaks, customer AI adds items live. Customer can correct by voice.
2. **Phase 2 — Merchant AI confirmation** (`pending`): Order sent to merchant AI. Customer sees live updates as merchant AI reviews, edits prices, substitutes items, confirms/rejects. No voice input from customer during this phase.

**Correction channel:** voice only for MVP (phase 1 only). The customer sees the error and says it again to the agent. **Do not add tap-to-edit during a live call** — two input channels racing to mutate the same order is a state-conflict bug with no clean resolution.

**Requires:** screen wake lock while the call is active. Poll at 1.5s during `placing`; 3s during `pending` — the feedback loop only works if it feels immediate.

### 5.7 Orders list (`/orders`)

Active orders pinned at top with live state chips and elapsed timers. Past orders below, grouped by date.

**Card:** shop name · state chip · item count · price (only if `confirmed`/`modified`) · elapsed timer for non-terminal states.

Multiple concurrent orders each carry their own independent timer and state chip — they must read as independent, since two shops confirm on their own schedules.

### 5.8 Order detail (`/orders/:id`)

The state machine surface. Renders per [§4](#4-order-state-machine).

Common elements: shop name and callable number, item list with quantities, timestamp, order ID.

State-specific:
- `pending` — elapsed timer, skeleton price, *"Shop is checking your order"*
- `confirmed` — price, ETA, green state
- `modified` — **diff block first**, then final order
- `rejected` — reason, then nearby alternatives in the same category
- `unreachable` — shop's direct number, prominent

Re-order button on terminal states, pre-filling the same shop.

### 5.9 Profile (`/profile`)

Verified number (display only, change via re-verification). Delivery addresses. **Preferred language** — feeds **L-03**, so the agent greets correctly on the very first call rather than guessing. Notification permissions. Logout.

---

## 6. The call button

The most important component. One per merchant card, persistent on merchant detail.

| State | Appearance | Behaviour |
|---|---|---|
| Ready | Coral fill, phone icon, "Call" | Initiates |
| Shop closed | Muted, hours shown | Disabled — never a dead button with no explanation |
| Connecting | Spinner, "Connecting…" | — |
| Permission needed | Prompt copy explaining mic use | WebRTC path only |
| Failed | Error + retry + call-directly fallback | Always offer the shop's real number |

**Transport must be swappable underneath the component.** The button's props and states do not change between WebRTC and PSTN/TwiML — only the handler does. See [§12](#12-open-decisions), Decision 1.

Minimum 56px height. Text label always, never icon-only (**L-12**).

---

## 7. Polling and data refresh

Naive `setInterval(5000)` will not work. **M-01** puts median merchant confirm latency in minutes, with p90 well beyond — polling every 5s for twenty minutes drains battery and burns API quota.

### Tiered backoff

| Phase | Interval |
|---|---|
| Live call — customer AI capture (`placing`) | 1.5s |
| Live call — merchant AI review (`pending`) | 3s |
| First 30s after capture | 3s |
| 30s – 3min | 10s |
| 3min – 10min | 30s |
| Beyond 10min | Stop — rely on notifications |

### Rules

- **Only poll non-terminal states.** `confirmed`, `modified`, `rejected`, `unreachable` stop polling immediately.
- **One endpoint for all active orders.** `GET /orders/active` returns an array. Never one timer per order.
- **Stop on tab background**, resume and reset to fast tier on foreground (Page Visibility API).
- **Elapsed time computed from server `created_at`**, never from a client-side counter.
- **Wake lock during live call only**, released on call end.

---

## 8. Notifications

The web app is stateless and the customer *will* close the tab. This makes notifications load-bearing, not supplementary.

### Three tiers

1. **In-app banner** — tab open. Immediate, free, reliable.
2. **Web Push** — where permission is granted and the platform supports it.
3. **SMS** — the guaranteed floor.

### The iOS gap

**Web Push on iOS Safari only works if the site is installed to the home screen as a PWA.** A customer who opens the URL in Safari and closes the tab receives nothing. Desktop and Android Chrome are fine.

Therefore **SMS is not a fallback, it is the floor**, and SMS copy is a design surface that must be specified: shop name, item count, price, and state, in the customer's language, within 160 characters. Budget it in the **E-01** economics — it is a real per-order cost.

**Permission timing:** request Web Push **after the first successful order**, never on landing. Also prompt PWA install at that moment, since that is what unlocks push on iOS.

### Merchant AI response time

Unlike human merchants on WhatsApp (median confirm latency in minutes, per **M-01**), the merchant AI agent should respond in seconds. The `pending` state is expected to be brief (typically <30s). If merchant AI exceeds 2 minutes without response, escalate to SMS notification with "merchant AI delayed" messaging and offer fallback to call the shop directly.

---

## 9. Empty, loading and error states

At launch these are the majority experience, not edge cases.

### Empty states

| Case | Screen shows |
|---|---|
| **No merchants in this category** | Category not live in your area yet · notify-me · categories that *are* live. Never a blank list. |
| **No merchants at all in pincode** | This is **B-07** (density) as UI. Capture the pincode as a demand signal — that data tells the field team where to onboard next. |
| **No orders yet** | Point at categories with one clear action. |
| **No past orders with this merchant** | Section hidden entirely, not shown empty. |

### Loading

Skeletons matching final layout, never spinners for content. The price slot in `pending` is a skeleton specifically — it must read as *not yet known*, never as zero or blank.

### Errors

Call failed, network lost mid-poll, order not found, session expired, OTP delivery failure. **Every call-related error offers the shop's real phone number as an escape hatch.** The customer's goal is to reach the shop; if the product fails, it should get out of the way rather than trap them.

---

## 10. Explicitly not building

Each of these is in the reference and each either contradicts the risk register or adds unmaintainable surface area.

| Dropped | Why |
|---|---|
| Star ratings, review counts | No review corpus; invites merchant gaming at 5 merchants |
| Price ranges on cards | Contradicts **B-01** / **D-05** — merchant prices the order, app must not imply one |
| Claim-a-business | Merchant onboarding is field-led, not self-claim |
| Bookmarks / favourites | Order history serves this better and is automatic |
| Five-tab nav | Cut to three (**L-12**) |
| Tabbed merchant detail | Single scroll |
| Illustrated hero images | Read as stock and generic |
| In-app payments | COD default; out of MVP scope |
| Tap-to-edit during live call | Two input channels racing on one order |
| WhatsApp merchant confirmation UI | **Phase 1:** merchant confirms via their own AI agent, not WhatsApp |
| Human merchant dashboard for order confirmation | Merchant AI handles confirmation; dashboard is analytics-only |

---

## 11. Build sequence

**Phase A — Shell (week 1)**
Design tokens, Devanagari type scale tested with mixed strings, three-tab nav, routing, auth screens, merchant card component, call button component with all states.

**Phase B — Core flow (week 2)**
Home, category list, merchant detail, call initiation, **live call screen (phase 1: customer AI capture)**, order state machine components.

**Phase C — AI-to-AI handoff (week 3)**
Live call screen phase 2 (merchant AI review), merchant AI integration (LiveKit room handoff or API bridge), orders list, order detail with all seven states, diff rendering for `modified`, tiered polling, elapsed timers, wake lock.

**Phase D — Edges (week 4)**
All empty states, all error states, SMS copy, Web Push + PWA install prompt, profile, reorder strip.

Phase D is not polish. Empty and error states are the majority experience at 5 merchants.

---

## 12. Open decisions

| # | Decision | Blocked on | Status |
|---|---|---|---|
| **1** | **Customer call transport: WebRTC vs PSTN/TwiML** | See below | **Open — blocks §5.6** |
| 2 | PWA install prompt timing and copy | Push permission conversion data | Open |
| 3 | Voice-only vs tap correction during live call | MVP: voice only. Revisit after accuracy data | Decided (provisional) |
| 4 | Desktop layout beyond 720px | Traffic split data | Deferred |
| 5 | Language toggle placement — profile only, or per-call | **L-03** / **L-04** behaviour in pilot | Open |
| **6** | **AI-to-AI handoff mechanism: LiveKit room transfer vs API bridge** | Merchant AI agent architecture | **Open — blocks Phase C** |
| **7** | **Merchant AI agent capabilities: confirm only vs full edit/substitute** | Merchant onboarding complexity | **Open — blocks Phase C** |

### Decision 1 in detail

**WebRTC (browser mic → LiveKit):** no PSTN leg to the customer, no per-minute cost, no caller-ID concept, no TRAI/DND exposure on outbound (**C-04**), arbitrary payload available (**T-01** app case). **Live order rendering works on mobile.**

**PSTN/TwiML (backend originates, customer's phone rings):** familiar call quality, works without mic permission, better audio in noisy environments (**L-11**). But it costs per minute, pulls DND into scope, and — decisively — **on mobile the customer is on a phone call, the browser is backgrounded, and the live order screen is invisible.**

**Recommendation:** WebRTC primary, PSTN fallback when mic is denied or network is poor. Build the call button so transport swaps without UI changes.

**This decision determines whether §5.6 — the app's most valuable screen — exists on mobile at all.**

### Decision 6: AI-to-AI handoff mechanism

**Option A — LiveKit room transfer:** Customer AI and merchant AI both run as LiveKit agents. After capture, customer AI transfers the room (or creates a new room) to merchant AI with order context in participant attributes. Seamless audio continuity, shared LiveKit infrastructure.

**Option B — API bridge:** Customer AI writes order to backend, publishes event. Merchant AI (separate worker, possibly different LiveKit project) polls/consumes event, processes, writes result back. Customer AI polls for result. Simpler isolation, easier to scale independently.

**Tradeoffs:** Option A gives true real-time feel (customer hears merchant AI "thinking"), but couples both agents to same LiveKit project and requires careful room lifecycle management. Option B is more decoupled but adds polling latency (mitigated by WebSocket push from backend).

**Recommendation:** Start with Option B (API bridge) for faster iteration and clearer separation of concerns. Move to Option A only if real-time feel proves critical for trust.

### Decision 7: Merchant AI agent capabilities

**Minimal:** Merchant AI only confirms/rejects with price. No substitutions, no quantity edits. Human merchant still needed for complex changes.

**Full:** Merchant AI has access to inventory/pricing, can substitute items, edit quantities, suggest alternatives. Fully autonomous confirmation.

**Tradeoffs:** Minimal is faster to build, lower risk of AI hallucination on substitutions. Full delivers on the "AI receptionist" promise but requires robust inventory/alias data per merchant (risk **D-06**).

**Recommendation:** Start with Minimal + "escalate to human" for complex cases. Full autonomy is a Phase 2+ feature once alias/inventory data quality is proven.

---

## Appendix — screens at a glance

| # | Screen | Route | Priority | Reference basis |
|---|---|---|---|---|
| 1 | Phone entry | `/auth/phone` | P0 | New |
| 2 | OTP | `/auth/otp` | P0 | New |
| 3 | Home | `/` | P0 | Adapted |
| 4 | Category list | `/category/:slug` | P0 | Adapted |
| 5 | Merchant detail | `/merchant/:id` | P0 | Heavily restructured |
| 6 | **Live call** | `/call/:orderId` | **P0** | **New — no reference** |
| 7 | Orders list | `/orders` | P0 | New |
| 8 | Order detail | `/orders/:id` | P0 | New |
| 9 | Profile | `/profile` | P1 | New |

Six of nine screens have no equivalent in the reference. The reference contributes visual language, not structure.

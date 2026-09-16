# Frontend agent notes

Customer-facing Next.js 14 App Router app. Read the root `CLAUDE.md` first, and `docs/shopassist-ui-plan.md` before touching any customer screen — route names, screen specs, and the "explicitly not building" list there are product decisions, not suggestions.

## Theme tokens (`tailwind.config.js`)

Client-supplied palette, extending (not replacing) the pre-existing `primary` blue scale that the unrelated merchant/product-catalog demo still uses elsewhere — don't repurpose `primary`.

| Token | Hex | Rule |
|---|---|---|
| `brand` / `brand-strong` | `#80c341` / `#6ba836` | Call-to-action green. One meaning only: places or confirms a call — the same rule the UI plan doc gives coral in its §3.2. Don't use it for anything else. |
| `accent` | `#87BD28` | Secondary/tertiary text, links, active states. **Contrast caveat:** under 3:1 on white — only use on ≥12px semibold labels (category tags, distances, timers), never on body copy. Body copy stays on `ink`. |
| `ink` | `#252525` | Primary text. |
| `amber` / `amber-bg` | `#B9791E` / `#FBF0DC` | "Needs attention" — reserved for low-confidence/edited states (risk IDs L-05, L-06, L-08 in the risk register). Not decorative. |
| `error` / `error-bg` | `#A94A3D` / `#F8E4E0` | Added — the UI plan's coral-only palette had no failure color once coral was reassigned. Used for `rejected` order states and failed calls. |

## Mock auth flow (`/auth/phone` → `/auth/otp`)

There is no real backend auth yet. The two auth screens call this Next app's own mock route handlers, not the FastAPI backend:

- `src/app/api/auth/request-otp/route.ts`, `verify-otp/route.ts` — dummy OTP is always `123456` (`src/lib/mockAuth.ts`, `DUMMY_OTP`), returned to the client as `devCode` and shown on-screen as a labeled dev hint. State lives in an in-memory `Map` (`otpStore`) — resets on server restart, 5 wrong attempts locks the number out.
- `src/lib/authClient.ts` calls `/api/auth/*` via `fetch`, **not** the `api` axios client in `src/lib/api.ts` (that one is pointed at the FastAPI backend on `localhost:8000`, which has no auth routes — don't wire auth through it).
- Phone number in flight is handed off via `sessionStorage` (`getPendingOtp`/`setPendingOtp`), not a URL query param — keeps the number out of browser history and avoids a Next 14 `useSearchParams` build issue on a top-level client page.
- A verified session (`{ phone, token }`) is persisted in `localStorage` (`getSession`/`setSession`/`clearSession`) — separate storage from the pending-OTP handoff on purpose (session should outlive a closed tab; the pending flow shouldn't).

## Session guard (`src/lib/useRequireSession.ts`)

Redirects to `/auth/phone` when no session exists. It's applied at the point of the gated action (the Call button's `onClick` on Home), **not** as a whole-page gate on `/` — the UI plan doc marks Home as "Public → gated: call requires auth," so the page itself must stay visible to logged-out visitors.

## `CallButton` (`src/components/CallButton.tsx`)

Icon-only circular button (brand-green fill, white mic glyph — `MicIcon`, chosen over a phone handset since the underlying action is a voice call the AI assistant listens in on), by explicit design direction. This deviates from the UI plan doc §6 / risk L-12 ("always a text label, never icon-only," aimed at an older, less app-fluent audience) — the accessible name still carries the full context (`aria-label`, `title`), so screen readers and hover get what the missing visible label would have said, but a sighted user does not. Worth revisiting with real users before this ships past mock data.

## Home screen dummy data (`src/lib/dummyData.ts`)

8 dummy merchants across 8 categories (Kirana, Dairy, Medical Shop, Garments, Flowers, Atta Chakki, Bakery, Stationery), English names only. Two fields are flagged, deliberate deviations from the UI plan doc's §10 ("no ratings," "no bookmarks/favourites" — no review corpus, invites gaming at low merchant counts):

- `rating` on `Merchant` — added because a specific card design was requested, not because that product decision changed.
- The like/heart toggle in `page.tsx` — same reasoning, kept as local-only UI state (not persisted anywhere).

`distanceKm` is still a static per-merchant number, not derived from any real coordinates. **This is now a deliberate, flagged gap, not an unbuilt one:** device location is real (see "Device location" below), but merchants have no coordinates, so nothing on the page currently uses the real location for filtering, sorting, or distance. Adding that touches this file's `Merchant` type and `filteredMerchants`/`reorderMerchants` in `page.tsx` together — it's a separate, larger change from the location work itself.

## Device location (`src/lib/useDeviceLocation.ts`, `src/components/LocationBar.tsx`)

Real: `navigator.geolocation.getCurrentPosition` → coordinates POSTed to `src/app/api/location/reverse-geocode/route.ts` → server-side call to Google's Geocoding API (reverse-geocoding mode) using `GOOGLE_MAPS_API_KEY` (server-only env var, never `NEXT_PUBLIC_*` — see `apps/frontend/.env.example`) → `{ pincode, area, formattedAddress }` back to the client. Parsing (`src/lib/geocode.ts`) scans every result's `address_components`, not just the first, because `postal_code` is often only present on a coarser result than the first one Google returns.

- `requestLocation()` must be triggered by a real user click (`LocationBar`'s "Use my location" button) — never fired on mount, both because most browsers require a user gesture before the permission prompt and because prompting on load is bad UX.
- Resolved location is cached in `localStorage` (`shopassist:location`, via `src/lib/locationClient.ts`) — same "should outlive a closed tab" reasoning as the auth session, not `sessionStorage`. Only `source: 'gps'` entries expire (6h TTL, worth rechecking against Google Maps Platform's caching terms before production traffic); a `source: 'manual'` entry (from the pencil icon's `window.prompt`, unchanged UX) never auto-expires.
- A transient geolocation error (denied/unavailable/timeout) never clears an already-resolved cached location — only the status changes.
- `reportEmptyLocationDemand()` in `locationClient.ts` is a ready-but-unwired seam for risk B-07 ("capture the pincode as a demand signal" when nothing's nearby) — it's not called from anywhere yet because `filteredMerchants` doesn't filter by location at all (see above), so that state can't actually occur until real distance-filtering ships.

## LiveKit voice call (`src/app/call/[merchantId]`, `src/components/CallScreen.tsx`, `src/app/api/livekit/token`)

The Home screen's `CallButton` now routes to `/call/[merchantId]` (a real LiveKit room, not the old mock `setStatus('Calling…')` flow) per explicit product direction — this is a change from the prior isolated-harness state, and it does **not** resolve the open items below, it just moves the entry point:

- **Product-level:** `docs/shopassist-risk-register.md`'s target user "has dialled one number for a decade" (Appendix Q3) — an in-browser WebRTC call is exactly the "customer app / click-to-call for younger segment" path the register's Open Decision #7 lists as **Deferred**, pending segment data that doesn't exist yet. Wiring this up doesn't resolve that decision; it stays open.
- **Auth:** the token-mint route (`api/livekit/token/route.ts`) is **not session-gated server-side** — there's nothing server-side to check a session against (see "Mock auth flow" above: in-memory OTP store, resets on restart). `/call/[merchantId]` only checks `getSession()` client-side before rendering and redirects to `/auth/phone` if absent, same as the old `handleCall` check — that's a UI gate, not a real one. The route treats `merchantId` as the only trusted input; room name and participant identity are always generated server-side (`crypto.randomUUID()`), never accepted from the client, so at minimum no caller can join or snoop another session's room. But anyone who can reach the route can mint a token against the real, billed LiveKit project in `.env`. Real gating is blocked on real backend auth.

Because this bypasses PSTN entirely (straight browser ↔ LiveKit), the telephony risk cluster (T-01–T-10: Twilio, SIP headers, caller ID, carrier compliance) doesn't apply to this path at all — it's sidestepped, not solved.

`CallScreen.tsx` visualizes the **caller's own mic**, not the assistant's — `useTracks([Track.Source.Microphone])` filtered to `participant.isLocal`, fed into `@livekit/components-react`'s `BarVisualizer`. `useVoiceAssistant()` still drives the "waiting for/listening to the assistant" status text. `apps/agents/src/agents/voice/livekit_agent.py` (Google Gemini Live API, generic conversation, no order-taking) auto-dispatches into any room this creates — run it with `uv run python -m agents.voice.livekit_agent dev` inside `apps/agents` (needs a real `GOOGLE_API_KEY` and the `LIVEKIT_*` values, same project as this app's `.env`, in `apps/agents/.env`). Order-taking (product tools, backend order endpoints) is a deliberate follow-up, not built yet.

The old harness (`src/app/dev/voice-call`, `src/components/VoiceCallHarness.tsx`) is unchanged and still dev-only/unlinked — kept for ad-hoc testing against an arbitrary merchant without going through Home.

**Not built:** call recording/consent UI (risk C-07) — flagged, not implemented.

## Not yet built

`/orders` and `/profile` are inert "coming soon" stubs (bottom nav in `page.tsx`). No merchant-detail screen, no order state machine — see the UI plan doc's route map (§2) for what's still outstanding. `/call/[merchantId]` (above) covers the live-call screen.

## Testing

`npm test` doesn't run — see the root `CLAUDE.md` for why. Verify changes with `npx tsc --noEmit` and a manual `npm run dev` check.

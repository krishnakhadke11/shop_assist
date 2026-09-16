# Frontend implementation notes

What's actually been built in `apps/frontend` so far, against the spec in `shopassist-ui-plan.md` and `shopassist-risk-register.md`. Written for a human reviewing progress — see `apps/frontend/CLAUDE.md` for the terser, agent-facing version of the same information.

## Screens built

| Route | File | Status |
|---|---|---|
| `/auth/phone` | `src/app/auth/phone/page.tsx` | Built — mock OTP send |
| `/auth/otp` | `src/app/auth/otp/page.tsx` | Built — mock OTP verify, resend, lockout |
| `/` (Home) | `src/app/page.tsx` | Built — categories, merchant list, reorder strip |

Not built: merchant detail, live call, orders list/detail, profile.

## Theme

Client-supplied palette applied via Tailwind tokens (`apps/frontend/tailwind.config.js`):

- **Brand green** `#80c341` — reserved for call/verify actions only (one meaning, matching the UI plan's original rule for coral).
- **Accent** `#87BD28` — secondary/tertiary text, links, active states. Kept off body copy since it falls under 3:1 contrast on white at normal text sizes.
- **Ink** `#252525` — primary text.
- **Amber** `#B9791E` — unresolved-quantity / needs-attention states, carried over from the original design system (risk IDs L-05, L-06, L-08).
- **Error (new)** `#A94A3D` — added for `rejected`/failed-call states; the original coral-only palette didn't need a separate failure color.

The existing `primary` blue scale (used by the unrelated merchant/product-catalog demo page's leftovers) was left alone.

## Mock auth

Two Next.js route handlers under `src/app/api/auth/` (`request-otp`, `verify-otp`) simulate an SMS OTP flow with no real backend or SMS provider:

- Dummy code is always `123456`, shown on the OTP screen as a labeled dev hint.
- 5 wrong attempts locks the number out; a fresh `request-otp` call resets it.
- State is in-memory (a `Map`) and resets whenever the dev server restarts — this is throwaway mock state, not a database.

A verified session (`{ phone, token }`) is stored in `localStorage`; `src/lib/useRequireSession.ts` is a guard hook that redirects to `/auth/phone` when it's missing. It's wired to the Home screen's Call button (calling requires a session) rather than gating the whole page, since Home itself is meant to be publicly visible.

## Home screen

Categories (Kirana, Dairy, Medical Shop, Garments, Flowers, Atta Chakki, Bakery, Stationery), a "Call again" reorder strip, and a merchant list — all from dummy data in `src/lib/dummyData.ts` (8 merchants, English names).

Merchant cards are horizontal (image thumbnail left, details right) with a rating badge and a like/heart toggle, following a specific reference design the team provided. The call button is icon-only (a circular brand-green button with a phone glyph, no visible text label).

## Deliberate deviations from `shopassist-ui-plan.md`

Flagged here and in code comments so they're a visible decision, not an oversight:

1. **Star ratings** on merchant cards — the UI plan's §10 drops these for lack of a review corpus at low merchant counts. Added because a specific card layout was requested. The `rating` field in `dummyData.ts` carries a comment noting this.
2. **Like/save button** — same section of the UI plan calls this out as unnecessary ("order history serves this better"). Added per the same card-design request; it's local UI state only, nothing persisted.
3. **Icon-only call button** — the UI plan's §6 (and risk L-12) call for a button that always shows a text label, aimed at an older, less app-fluent audience. The current button is icon-only by explicit design direction; the accessible name (`aria-label`, `title`) still carries the context for screen readers, but a sighted user only sees an icon.

None of these are hard to reverse — they're isolated to `dummyData.ts` and the merchant-card JSX in `page.tsx` — but worth a real product/design call before they go further than mock data.

## What's still missing for location/distance

`distanceKm` on each dummy merchant is a static number — there's no geolocation, Google Maps integration, or real distance calculation anywhere in the repo yet. The UI plan's pincode field (top of Home, currently just local display state you can edit via a prompt) is cosmetic today; wiring in real location would touch that state, `dummyData.ts`'s `Merchant` type, and needs an API key decision (client-exposed `NEXT_PUBLIC_*` var vs. a server-side proxy) since no such key exists in any `.env.example` yet.

## Known tooling gap

`npm test` in `apps/frontend` doesn't run — `jest.config.js` has an invalid option (`setupFilesAfterSetup`, should be `setupFilesAfterEnv`) and is missing `ts-jest`, `jest-environment-jsdom`, and `@types/jest` as dependencies. All frontend work described above was verified with `npx tsc --noEmit` plus manual `npm run dev` checks instead. Fixing the harness is a separate, standalone task.

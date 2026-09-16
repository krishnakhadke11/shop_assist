# Shop Assist — agent notes

Monorepo: `apps/frontend` (Next.js customer app), `apps/backend` (FastAPI), `apps/agents` (voice/chat AI agents). Stack and directory layout are in `README.md` — don't re-derive them here.

## Product source of truth

Before changing anything customer-facing, read `docs/shopassist-ui-plan.md` (UI/UX spec, route map, design system) and `docs/shopassist-risk-register.md` (the risk IDs like B-01, L-05, L-06 referenced throughout the code and comments). These are the actual product decisions — the code should match them, and where it doesn't, that's called out explicitly in comments (see `apps/frontend/CLAUDE.md`) rather than silently.

## Current state

The customer frontend (`apps/frontend`) is a mock-data build-out: no real backend auth or merchant data yet. See `apps/frontend/CLAUDE.md` for what's real vs. mocked, the theme, and known deviations from the UI plan doc. See `docs/frontend-implementation-notes.md` for a fuller changelog-style writeup of what's been built.

`apps/backend` is largely untouched scaffolding — no work described here has reached it yet (only product CRUD exists; no orders/merchants/webhooks). `apps/agents` has more built than that framing suggests: a working LangChain-style chat/tool-calling skeleton (`src/agents/{base,chat,tools,supervisor,tasks}`) plus a LiveKit voice agent (`src/agents/voice/livekit_agent.py`) that joins the room the frontend's `/dev/voice-call` harness creates and has a generic spoken conversation via Google's Gemini Live API — see `apps/frontend/CLAUDE.md`'s "LiveKit voice-call harness" section. None of it does order-taking yet; that's still ahead of both apps.

## Known-broken tooling

`apps/frontend`'s Jest setup does not run: `jest.config.js` has `setupFilesAfterSetup` (not a real Jest option — should be `setupFilesAfterEnv`), and `ts-jest` / `jest-environment-jsdom` / `@types/jest` are referenced but not installed. Don't trust `npm test` output there until this is fixed. Verify frontend changes with `npx tsc --noEmit` plus a manual dev-server check instead.

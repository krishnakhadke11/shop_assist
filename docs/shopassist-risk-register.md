# ShopAssist — Risk Register & Engineering Challenges

**Product:** AI voice receptionist for SME retail (kirana, dairy, atta chakki) — customer calls a merchant number, an AI agent takes the order in Hindi/Marathi/Hinglish, **merchant's AI agent confirms/edits/rejects via LiveKit**.

**Status:** Pre-MVP. Stack under evaluation: LiveKit Agents (customer + merchant) → FastAPI → Postgres/Redis. React dashboard.

**Purpose of this document:** a single register of everything that can kill, stall, or silently degrade this product. Each risk has an owner-facing description, why it happens, what it costs, and — critically — **the metric that tells you it is happening**. Risks without a detection metric are risks you will discover from an angry merchant, not a dashboard.

---

## How to read this

| Field | Meaning |
|---|---|
| **ID** | Stable reference. Use in tickets. |
| **Severity** | P0 = can kill the company. P1 = can kill a cohort or a quarter. P2 = degrades quality/margin. P3 = watch item. |
| **Horizon** | When it bites: MVP / Pilot (5–50 merchants) / Scale (500+) |
| **Detection** | The metric or alert that surfaces it before a human complains |

**Rule adopted for this register:** any P0 or P1 without a named detection metric is itself a defect. Fix the instrumentation before the feature.

---

## Table of contents

1. [Existential / business-critical](#1-existential--business-critical)
2. [Language, dialect and speech understanding](#2-language-dialect-and-speech-understanding)
3. [Telephony, routing and caller identity](#3-telephony-routing-and-caller-identity)
4. [Scaling and system design](#4-scaling-and-system-design)
5. [Data correctness and state](#5-data-correctness-and-state)
6. [Merchant adoption and operations](#6-merchant-adoption-and-operations)
7. [Compliance and legal](#7-compliance-and-legal)
8. [Unit economics](#8-unit-economics)
9. [Metrics catalogue](#9-metrics-catalogue)
10. [Open decisions](#10-open-decisions)
11. [Pre-launch gate](#11-pre-launch-gate)

---

## 1. Existential / business-critical

### B-01 — No inventory system means the AI cannot confirm anything
**Severity:** P0 · **Horizon:** MVP

A kirana has no SKU list, no stock feed, no digitised prices. The agent therefore cannot confirm availability or price during the call. It can only capture *intent*.

Any design that lets the agent say "your order is confirmed" is broken. The architecture must be two-phase: **customer AI captures → merchant AI confirms/prices/edits → customer notified.** If synchronous confirmation leaks into the UX (or the prompt), you will ship orders that do not exist.

**Consequence if ignored:** customer expects goods, merchant never saw or rejected the order, trust destroyed on both sides simultaneously.

**Detection:** transcript audit for confirmation language; % of calls where agent asserted price or availability. Target 0%.

---

### B-02 — Merchant willingness-to-pay is near zero in this segment
**Severity:** P0 · **Horizon:** Pilot

Kirana owners abandon software. Subscription is dead on arrival — see [§8](#8-unit-economics). Pricing must be per-completed-order and must be visibly smaller than the merchant's margin on that order.

**Unvalidated assumption:** that a merchant will pay ₹3–8 per captured order. This has not been tested with money changing hands.

**Detection:** paid-conversion rate from free pilot; churn at first invoice. **Kill threshold:** <30% convert to paid after a free month.

---

### B-03 — The missed-call problem may be smaller than assumed
**Severity:** P0 · **Horizon:** Phase 0

Entire product rests on merchants losing meaningful revenue to unanswered calls. If a missed customer simply walks to the shop, the addressable pain collapses.

**Must measure before building:** missed calls/day/merchant, and what fraction of missed callers never transact. **Kill threshold:** <8 missed calls/day median.

---

### B-04 — Quick-commerce substitution
**Severity:** P1 · **Horizon:** Pilot

In Mumbai, Blinkit/Zepto/Instamart already own "I need atta in 20 minutes." The defensible user is the one who does not use those apps — typically older, relationship-driven, credit/khata-based, calls the shop from muscle memory.

**Risk:** building for a demographic that is being actively eroded. **Detection:** age/segment distribution of callers; repeat-caller rate by cohort.

---

### B-05 — Merchant AI adoption vs human workflow
**Severity:** P1 · **Horizon:** Pilot

The merchant must trust and use their AI agent for confirmation. If the merchant ignores the AI, falls back to manual WhatsApp/phone, or disables the AI agent, the confirmation loop breaks and the product fails.

**The honest defence:** merchant AI is faster, cheaper, and always available vs. human checking WhatsApp during rush hour. **This must be validated with real merchants, not assumed.**

**Detection:** merchant AI confirmation rate (orders confirmed by AI / total orders); merchant AI disable rate; fallback-to-human rate.

---

### B-06 — No moat
**Severity:** P1 · **Horizon:** Scale

Every component is a vendor. Exotel, Ozonetel, or a quick-commerce player could ship this in a quarter. The only accumulating assets are: (a) the Hinglish/dialect order-speech corpus, (b) merchant-level item/price/alias data, (c) customer↔merchant order history graph, (d) field distribution.

**Action:** treat the call corpus as a first-class asset from call #1. Store audio + transcript + corrected order for every call.

---

### B-07 — Directory is a decoy
**Severity:** P1 · **Horizon:** Strategic

A regional directory of kirana shops competes with JustDial and Google Business Profile, both of which do it better and free. Directory only becomes viable *after* 50+ merchants in one pin code, and it is buildable on top of receptionist infrastructure. The reverse is not true.

**Decision recorded:** receptionist first, directory as a Phase-3 unlock.

---

### B-08 — Liability when the AI takes a bad order
**Severity:** P1 · **Horizon:** Pilot

Merchant confirms an order the AI mis-captured, delivers wrong goods, customer refuses to pay. Whose loss? No contract currently addresses this. At scale this becomes a systematic cost centre.

**Detection:** order dispute rate; merchant-reported wrong-order count per 100 orders.

---

### B-09 — Merchant AI hallucination / wrong edits
**Severity:** P0 · **Horizon:** MVP

The merchant AI has access to inventory/pricing data but may hallucinate prices, substitute wrong items, or edit quantities incorrectly. Unlike a human merchant who knows their stock, the AI operates on potentially stale or incomplete data.

**Consequence:** customer receives wrong price/items, trust destroyed, disputes increase.

**Mitigation:** 
- Merchant AI must cite source for every price/quantity decision (inventory snapshot timestamp)
- Low-confidence edits flagged for human review
- Deterministic price lookup, not LLM inference
- Human-in-the-loop for first N orders per merchant

**Detection:** merchant AI edit error rate (human-audited); price discrepancy rate at delivery; customer dispute rate segmented by AI-edited vs human-confirmed orders.
---

### B-10 — AI-to-AI handoff failure
**Severity:** P0 · **Horizon:** MVP

The handoff from customer AI to merchant AI (via LiveKit room transfer or API bridge) can fail: network timeout, context loss, merchant AI offline, schema mismatch. A failed handoff leaves the order in limbo — customer thinks it's placed, merchant never sees it.

**Mitigation:**
- Idempotent handoff with persistent order ID
- Customer AI retains ownership until merchant AI acknowledges
- Explicit timeout with customer-visible fallback ("merchant AI unavailable, trying shop directly")
- Dead letter queue for failed handoffs with alerting

**Detection:** handoff success rate; handoff latency p95; orders stuck in `captured` > 2 min; merchant AI offline rate.
---

### B-11 — Merchant AI latency vs customer expectation
**Severity:** P1 · **Horizon:** Pilot

Customer waits on the call (or watches the screen) while merchant AI processes. If merchant AI takes >30s, customer perceives it as broken. Unlike human merchant on WhatsApp (minutes of latency expected), AI-to-AI sets sub-minute expectation.

**Mitigation:** 
- Stream partial results (merchant AI "thinking" → "checking prices" → "confirming")
- Parallel price/inventory lookup
- Hard timeout: if merchant AI > 60s, escalate to human or SMS fallback

**Detection:** merchant AI response time p50/p95; customer hang-up rate during `pending`; escalation rate.
---

## 2. Language, dialect and speech understanding

> This section is the single largest source of technical risk. Order-taking speech in an Indian retail context is code-mixed, noisy, elliptical, and full of non-standard quantity terms. Off-the-shelf ASR benchmarks are measured on read speech and will not predict performance here.

### L-01 — Code-mixing is the default, not the exception
**Severity:** P0 · **Horizon:** MVP

Real utterance shape: *"Ek pav Amul butter, sawa kilo Aashirvaad atta, aur do Maggi."* — three languages, a brand name, a non-metric unit, a colloquial fraction, all in one breath.

Monolingual ASR models degrade sharply on intra-sentential code-switching. A model configured as `hi-IN` will mis-transcribe English brand tokens; configured as `en-IN` it will mangle the Hindi.

**Mitigation:** choose ASR with explicit code-switch support (Sarvam Saarika, Google Chirp, Bhashini). Evaluate on *your* recorded corpus, never on vendor benchmarks.

**Detection:** WER measured separately on Hindi tokens, English tokens, and brand tokens. Aggregate WER hides the failure.

---

### L-02 — Dialect ≠ language, and Mumbai is not Delhi
**Severity:** P0 · **Horizon:** Pilot

Most Hindi ASR is trained on Khariboli/Delhi-standard Hindi. Mumbai's spoken register (Bambaiya) differs in vocabulary, word order, and pronunciation. Add Marathi speakers, Gujarati merchant families, and UP/Bihar migrant speech within the same pin code.

Failure mode is subtle: the model returns *plausible but wrong* text with high confidence, so confidence thresholds do not catch it.

**Mitigation:** dialect-stratified eval set. Sample calls by merchant locality and speaker origin, not at random. Consider per-merchant language defaults from onboarding.

**Detection:** WER and order-accuracy **segmented by merchant locality and by detected speaker language**. A single global accuracy number is actively misleading here.

---

### L-03 — You do not know the language until the caller speaks
**Severity:** P1 · **Horizon:** MVP

The agent must open the call before it has heard anything. Greeting in the wrong language costs trust in the first two seconds.

**Options:** (a) merchant-configured default language per DID — cheap, correct most of the time; (b) neutral/bilingual greeting then switch; (c) runtime language ID on first utterance, which adds latency.

**Recommended:** merchant default from onboarding, with runtime switch on detection. Store detected language on the customer record so the *second* call is always right.

**Detection:** language-switch rate after greeting; hang-up rate within first 5 seconds, segmented by greeting language.

---

### L-04 — Mid-call language switching
**Severity:** P1 · **Horizon:** Pilot

Callers switch languages mid-sentence, or switch when frustrated, or a second household member takes the phone and speaks a different language. A pinned session language breaks; unpinned language ID flaps.

**Mitigation:** per-utterance language detection with hysteresis (do not switch on a single ambiguous turn). Agent TTS language should follow the caller with a lag, not instantly.

**Detection:** count of language flips per call. >2 flips is a probable ASR artifact, not real behaviour.

---

### L-05 — Non-metric and colloquial quantities
**Severity:** P0 · **Horizon:** MVP

Common terms with no direct numeric mapping in a general LLM's default behaviour:

| Term | Meaning |
|---|---|
| pav / paav | quarter (250 g of a kg) |
| adha / aadha | half |
| pauna / paune | three-quarters (¾), or "less a quarter" before a number |
| sawa | one and a quarter |
| dedh / derh | one and a half |
| dhai / adhai | two and a half |
| tola | ~11.66 g (rare, but appears) |
| ek packet / ek pouch / ek dabba | unit depends entirely on the product |

*"Paune do kilo"* = 1.75 kg. *"Sawa kilo"* = 1.25 kg. These are routine, not edge cases.

**Mitigation:** deterministic normalisation table, **not** LLM inference. The LLM extracts the raw phrase; a lookup converts it. Any quantity the table cannot resolve is flagged for merchant confirmation rather than guessed.

**Detection:** % of orders containing an unresolved quantity token; merchant edit rate on the quantity field specifically.

---

### L-06 — Quantity errors are the highest-cost error class
**Severity:** P0 · **Horizon:** MVP

*"Do kilo"* mis-heard as *"do sau gram"* is an 10× error that reaches the customer as a wrong delivery. Item errors are usually caught by the merchant ("we don't stock that"); quantity errors look plausible and pass straight through.

**Mitigation:** always read back quantities in the confirmation; render quantity prominently and editably in the merchant WhatsApp card; treat low-confidence numerals as mandatory-confirm.

**Detection:** **quantity-field edit rate on the merchant confirmation card** — the single most valuable accuracy proxy you have, because it is free and merchant-verified. Target <8%.

---

### L-07 — Brand names used as generic nouns
**Severity:** P1 · **Horizon:** Pilot

*Colgate* means toothpaste. *Surf* means detergent. *Maggi* means instant noodles. *Amul* may mean butter, milk, or cheese depending on context and merchant. The customer may accept a different brand, or may not.

**Mitigation:** alias table maps token → canonical item + optional brand, with a `brand_is_specific` flag. Ambiguous cases surface to the merchant rather than being resolved by the model.

**Detection:** merchant edit rate on brand field; customer complaint rate on brand substitution.

---

### L-08 — Regional item names for the same product
**Severity:** P1 · **Horizon:** Pilot

doodh/dudh/milk; atta/aata/gehun ka atta; dahi/curd/yoghurt; jeera/cumin; kothimbir/dhania/coriander (Marathi vs Hindi). One canonical item may have 8–15 valid surface forms across languages and spellings.

**Mitigation:** alias table is a first-class, editable data asset. Must be updatable by a non-engineer, at 11pm, without a deploy.

**Detection:** count of unmatched item strings per week — this is your alias-table backlog and should trend down.

---

### L-09 — Fuzzy matching false positives
**Severity:** P1 · **Horizon:** Pilot

Loose matching to absorb ASR variance ("aata"→"atta") will also match things it should not (e.g. *dal* vs *daliya*, *saunf* vs *sauf* vs *sofa*). Tightening it raises unmatched rate; loosening it raises wrong-item rate.

**Mitigation:** tiered matching — exact → alias table → phonetic (Indic-aware, not Soundex) → reject to merchant. Never let the last tier be "LLM guesses."

**Detection:** track wrong-item rate and unmatched rate as a pair. Optimising one alone is how this goes wrong.

---

### L-10 — Digit strings over voice are unreliable
**Severity:** P1 · **Horizon:** MVP

Phone numbers spoken in mixed language (*"nau आठ seven six..."*), with Indian grouping conventions (*"double five"*, *"triple two"*), in shop noise, are a known ASR weak point. A single wrong digit sends order details to a stranger.

**Mitigation:** prefer **DTMF keypad entry** for phone numbers. Speech capture only as fallback, always with read-back confirmation. Validate against Indian mobile format before accepting.

**Detection:** SMS/WhatsApp delivery-failure rate on captured numbers; invalid-format rejection rate.

---

### L-11 — Acoustic environment
**Severity:** P1 · **Horizon:** Pilot

Calls originate from streets, kitchens, moving vehicles, and shops with other customers talking. Expect traffic noise, horns, overlapping speakers, TV/radio, and low-end handset microphones on 2G/VoLTE codecs.

Narrowband PSTN codecs (G.711/AMR-NB) further degrade the signal before ASR ever sees it.

**Mitigation:** evaluate ASR on *telephony-band* audio, not studio samples. Any accuracy figure measured on clean wideband audio is fiction.

**Detection:** WER bucketed by estimated SNR; hang-up rate on low-SNR calls.

---

### L-12 — Elderly and atypical speech
**Severity:** P1 · **Horizon:** Pilot

The core demographic — older customers who prefer calling — is also the demographic with slower speech, longer pauses, and less clear articulation. This is a direct conflict between your target user and your technology's strength.

**Mitigation:** generous endpointing/silence thresholds (aggressive VAD will cut them off mid-sentence, which is worse than a slow turn); patient re-prompts; never more than one clarifying question per turn.

**Detection:** turn-truncation rate; average pause length before endpointing; completion rate segmented by caller age cohort where known.

---

### L-13 — Barge-in and turn-taking
**Severity:** P1 · **Horizon:** MVP

Callers interrupt. They also say "haan", "accha", "hmm" as backchannel while the agent is speaking — which naive barge-in treats as an interruption, stopping the agent mid-sentence and derailing the call.

**Mitigation:** distinguish backchannel from genuine interruption (duration + content heuristics). Tune per language — backchannel patterns differ between Hindi and Marathi.

**Detection:** false-barge-in rate; agent-utterance truncation rate.

---

### L-14 — TTS accent and register mismatch
**Severity:** P2 · **Horizon:** Pilot

A pure Delhi-Hindi TTS voice speaking to a Marathi-first Mumbai caller reads as an outsider or a call-centre bot. Voice choice affects trust and completion rate, and is measurable.

**Mitigation:** A/B test voices per region. Prefer vendors with Indic-native voices (Sarvam Bulbul, Google Indic) over globally-trained voices with an Indian accent applied.

**Detection:** completion rate and hang-up rate by TTS voice variant.

---

### L-15 — Ellipsis and context-dependent orders
**Severity:** P1 · **Horizon:** Pilot

*"Wahi wala jo pichli baar liya tha."* / *"Roz wala bhej do."* / *"Same as usual."* — semantically empty without order history.

**Mitigation:** load customer×merchant history into session context at call start. Without history, the agent must gracefully say it will ask the shop to check — not guess.

**Detection:** % of calls containing a history reference; % of those resolvable. This is also the metric that justifies investment in customer identity ([§3](#3-telephony-routing-and-caller-identity)).

---

### L-16 — Prompt and schema drift across languages
**Severity:** P2 · **Horizon:** Scale

A prompt tuned on Hindi transcripts will silently underperform on Marathi. Structured-output adherence also degrades on lower-resource languages.

**Mitigation:** per-language eval suites in CI. Never ship a prompt change validated on one language only.

**Detection:** schema-violation rate and extraction accuracy, segmented by language, gated in CI.

---

## 3. Telephony, routing and caller identity

**Architecture note:** Phase 1 uses **WebRTC via LiveKit** as the primary customer call path (browser → LiveKit → customer AI). PSTN/Twilio is a fallback for customers who cannot use WebRTC (mic denied, poor network, older devices). This eliminates most telephony risks below for the primary path, but they remain relevant for the fallback path.

### T-01 — PSTN carries no payload (fallback path only)
**Severity:** P1 (design constraint) · **Horizon:** MVP (fallback)

A call from a normal handset carries only dialed number and (sometimes) calling number. There is no metadata channel. Merchant identity **must** be derived from the dialed number via database lookup.

**Resolved design:** Twilio Programmable Voice webhook → merchant lookup in FastAPI → TwiML `<Dial><Sip>` to LiveKit with `X-` headers (merchant ID, customer number, language, history flag) → LiveKit exposes as participant attributes → agent starts with full context. Single catch-all dispatch rule; all variation in code, not infrastructure.

---

### T-02 — Caller ID is unreliable through call forwarding (fallback path only)
**Severity:** P0 · **Horizon:** MVP (fallback)

On a forwarded leg, `From` may contain the *merchant's* number rather than the customer's, with the original in `Diversion` or `History-Info` — or absent entirely. Behaviour varies by carrier and interconnect path. CLI handling is also regulated in India, so some stripping is policy, not bug.

**Silent-corruption variant:** if `From` is stored naively, every forwarded call is attributed to the merchant's own number, producing a customer history that is uniformly wrong and invisible for months.

**Mandatory rule:** if extracted number == merchant number → treat as absent.

**Mitigation ladder:** SIP headers → merchant supplies/corrects number on the WhatsApp confirmation card → agent asks in-call (DTMF preferred) → merchant calls customer directly.

**Blocking action:** carrier matrix test (Jio/Airtel/Vi × forwarded/direct/withheld/landline), dumping full INVITE headers. **This must precede further design work on identity.**

**Detection:** % of orders per identity-resolution tier. If tier 1 (SIP) is <50%, the forwarding topology is in question.

---

### T-03 — Provisioned DID solves identity but creates an adoption problem (fallback path only)
**Severity:** P0 · **Horizon:** Pilot (fallback)

Direct-dialed DID gives clean `From` (customer) and unambiguous `To` (merchant). Both routing and identity problems dissolve.

But it requires customers to dial a *new* number. The merchant's existing number is on their board and in 800 phones. Migration is the risk that decides the topology.

**Detection:** % of a merchant's historical callers who migrate within 30 days. **Kill threshold for DID-only:** <40% migration.

**Note:** falling back to unconditional forwarding from the old number to the DID reintroduces T-02.

---

### T-04 — Forwarding is configured on the merchant's handset and cannot be verified remotely (fallback path only)
**Severity:** P1 · **Horizon:** Pilot (fallback)

`*67*<number>#` style codes must be dialled by the merchant. You cannot provision, verify, or repair this remotely. A phone change, SIM swap, or settings reset silently disables the product, and a merchant with broken forwarding is indistinguishable from a merchant with no missed calls.

**Detection:** **calls-received-per-merchant-per-week; alert on drop to zero.** Expect this to be a top-3 support driver.

---

### T-05 — Race between merchant pickup and forwarding (fallback path only)
**Severity:** P2 · **Horizon:** Pilot (fallback)

Merchant answers on the last ring while forwarding has already fired. Both legs live, or the customer hears the AI after the merchant said hello.

**Mitigation:** tune ring-timeout with merchants; detect and terminate duplicate legs.

**Detection:** duplicate-leg rate; sub-3-second AI call durations.

---

### T-06 — Webhook sits synchronously in the call path (fallback path only)
**Severity:** P1 · **Horizon:** MVP (fallback)

The Programmable Voice webhook blocks call setup. A slow or down FastAPI service is dead air on a live call.

**Mitigation:** hard p99 budget (<300 ms); merchant config cached in Redis; **mandatory fallback TwiML** on lookup failure (generic agent, no context — never a failed call). Enrichments (order history, preferences) are best-effort with timeouts; identity resolution is the only mandatory lookup.

**Detection:** webhook p50/p95/p99; fallback-TwiML invocation rate.

---

### T-07 — Sensitive data in SIP headers (fallback path only)
**Severity:** P1 · **Horizon:** MVP (fallback)

Customer phone number and customer ID in `X-` headers are visible to intermediaries in the signalling path.

**Mitigation:** pass an opaque session token, not PII; agent resolves it against Redis. Costs one lookup, removes the exposure.

---

### T-08 — Media-plane / control-plane separation
**Severity:** P1 · **Horizon:** Scale

Audio must flow Twilio → LiveKit → agent worker. If FastAPI ever touches media packets, it becomes a bottleneck that cannot be scaled out of.

**Detection:** architectural review; assert no media dependency in API service.

---

### T-09 — India telephony compliance
**Severity:** P0 · **Horizon:** Pilot (not MVP)

VoIP↔PSTN interconnect in India requires a UL/VNO-licensed operator in the path. Twilio is acceptable for a demo on a non-Indian number; production Indian traffic likely requires Exotel / Ozonetel / Knowlarity / Plivo-India / Airtel IQ.

**Mitigation:** thin telephony interface (inbound event, media handle, hangup) behind which the provider is swappable. Target: provider migration is one week, not a rewrite.

**Blocking action:** written compliance answer from at least two providers on AI-answered inbound with recording.

---

### T-10 — DID inventory, KYC and reclamation at scale
**Severity:** P1 · **Horizon:** Scale

Indian DIDs require per-number KYC and carry per-number rental. At 500–5,000 merchants this is a paperwork operation and a recurring cost line. Reclaimed numbers from churned merchants continue to receive calls from customers reading an old shop board.

**Mitigation:** quarantine period before reissue; polite recorded message on reclaimed numbers.

**Detection:** monthly DID spend per active merchant; calls to reclaimed numbers.

---

## 4. Scaling and system design

### S-01 — Agent workers scale on concurrent calls, not RPS
**Severity:** P0 · **Horizon:** Scale

A worker holding a live call cannot be killed. This breaks standard autoscaling and rolling-deploy assumptions.

**Requirements:** graceful drain (stop accepting, finish in-flight, exit); predictive scale-up ahead of the 6–9pm peak, because cold start during a rush is silence on a live call; measured — not assumed — concurrent-sessions-per-worker capacity.

**Detection:** concurrent sessions per worker; time-to-ready on scale-up; calls dropped during deploy (target 0).

---

### S-02 — Vendor concurrency limits bite before infrastructure does
**Severity:** P0 · **Horizon:** Scale

50 simultaneous calls = 50 open streaming ASR sessions + 50 TTS streams + sustained LLM TPM. ASR/TTS concurrency caps and LLM rate limits will throttle you long before pods are stressed.

**Action:** obtain and document written concurrency ceilings for every vendor **before** they are needed. Load-test to the ceiling, not to infrastructure limits.

**Detection:** vendor 429/throttle rate; headroom to documented cap.

---

### S-03 — Synchronised peak load
**Severity:** P1 · **Horizon:** Scale

Every merchant peaks simultaneously (approx. 6–9pm). Concurrency is not smoothed by merchant count — it multiplies. Capacity model must be built on peak-hour concurrency, not daily averages.

**Detection:** peak concurrent calls; peak-to-mean ratio.

---

### S-04 — Latency budget
**Severity:** P0 · **Horizon:** MVP

Target voice-to-voice (end of caller speech → first audio byte out) **<1.2 s p95**. Above this the call feels broken and callers talk over the agent.

Budget must be split: endpointing/VAD, ASR finalisation, LLM, TTS first byte, network. Aggregate latency is useless for debugging.

**Contributing risks:** Twilio SIP edge region (Singapore vs Mumbai), LiveKit region (must be `ap-south`), vendor cold starts, synchronous enrichment in the webhook.

**Detection:** per-turn breakdown, p50/p95/p99, tracked per component. Alert on any single component exceeding its sub-budget.

---

### S-05 — Notification fan-out, retries and idempotency
**Severity:** P0 · **Horizon:** MVP

Order must be committed to Postgres **before** notification is enqueued; never notify from inside the call handler (calls drop, workers crash). Delivery is at-least-once, so every job carries an idempotency key or the merchant sees duplicate orders.

**Outbox required:** if the DB write succeeds and the enqueue fails, the order is orphaned. Transactional outbox + reconciliation sweep.

**Detection:** duplicate-notification rate (target 0); orphaned-order count from reconciliation sweep (target 0).

---

### S-06 — Escalation ladder for unacknowledged orders
**Severity:** P0 · **Horizon:** MVP

Silent failure destroys both merchant and customer trust simultaneously. Ladder: WhatsApp → retry at 60 s → SMS at 3 min → automated voice call to merchant at 5 min → reassign or call customer back.

Shop hours and merchant presence belong in the *routing* decision, not the escalation decision — do not notify a closed shop and then escalate for five minutes.

**Detection:** escalation-stage distribution; % of orders reaching final stage.

---

### S-07 — Atomic claim on any broadcast order
**Severity:** P1 · **Horizon:** Scale (directory phase)

If one order is ever offered to multiple merchants, two simultaneous confirms must not both win. Row-level lock or Redis lock; loser receives explicit "already taken" state, never a dangling order they believe they own.

**Detection:** double-claim count (target 0).

---

### S-08 — Confirm/escalation race
**Severity:** P1 · **Horizon:** Pilot

Merchant taps Confirm at the same instant the 5-minute escalation reassigns. Requires a single authoritative state machine with guarded transitions.

**Detection:** state-transition conflict count.

---

### S-09 — Session state and mid-call disconnection
**Severity:** P1 · **Horizon:** MVP

Caller hangs up 20 s into a 5-item order. Partial order must persist. Session state in Redis with TTL allows a redial within a few minutes to resume rather than restart — high-value feature, near-free.

**Detection:** partial-order count; resume-on-redial rate.

---

### S-10 — Multi-merchant order fan-out (directory phase)
**Severity:** P1 · **Horizon:** Scale

"Milk, atta and eggs" is one utterance and three merchants. Order model must be parent order → per-merchant sub-orders, independently confirmable and independently failable, with partial-fulfilment states and a coherent customer-facing story.

**Design now even if MVP hardcodes single-merchant** — retrofitting this is a full data migration.

---

### S-11 — Observability
**Severity:** P0 · **Horizon:** MVP

One trace per call, with turn-level timing broken into ASR / LLM / TTS / network. Store audio + transcript + extracted order + merchant-corrected order for every call. That corpus is simultaneously the debugging tool, the eval set, and the primary moat ([B-06](#b-06--no-moat)).

---

### S-12 — Storage growth and retention
**Severity:** P2 · **Horizon:** Scale

Full-call audio at scale becomes a real cost line and a DPDP retention question. Define retention policy before volume, not after.

**Detection:** monthly storage cost; audio retained beyond policy window.

---

## 5. Data correctness and state

### D-01 — Customer identity must not be keyed on phone number
**Severity:** P0 · **Horizon:** MVP

Phone numbers arrive late, arrive wrong, arrive absent, or get corrected by the merchant. If phone number is the primary key of the customer entity, every identity fallback becomes a migration.

**Design:** stable internal customer ID; phone numbers are attributes with provenance and confidence.

---

### D-02 — Number provenance for consent
**Severity:** P1 · **Horizon:** Pilot

A number captured to fulfil an order is consented for that order, not for marketing. Store *how* each number was obtained alongside it.

---

### D-03 — Merchant-entered number typos
**Severity:** P1 · **Horizon:** Pilot

A fat-fingered digit sends order details — including a delivery address — to a stranger. Format validation, checksum where possible, and confirmation-before-send.

**Detection:** delivery-failure rate; complaints from non-customers.

---

### D-04 — Shared household numbers
**Severity:** P2 · **Horizon:** Pilot

Two people, one landline or one family phone. One customer record or two? Affects order history and the "same as usual" feature.

---

### D-05 — Stale prices
**Severity:** P1 · **Horizon:** Pilot

Prices change weekly, and sharply around festivals. If the agent ever quotes a price, it will eventually quote a wrong one. Reinforces [B-01](#b-01--no-inventory-system-means-the-ai-cannot-confirm-anything): agent captures, merchant prices.

---

### D-06 — Item list is the onboarding bottleneck
**Severity:** P0 · **Horizon:** Scale

Every merchant needs items with local names and prices. If this requires a field visit, CAC is ~₹800/merchant and this is a services business, not a software business.

**Mitigation:** photo of price board → OCR → merchant corrects over WhatsApp. Every merchant onboarded without a human visit is the difference between a business and a consulting engagement.

**Detection:** % of merchants onboarded with zero field visits; hours of human time per merchant.

---

### D-07 — Alias/category table must be editable without a deploy
**Severity:** P1 · **Horizon:** Pilot

New categories, new brands, new regional terms arrive continuously. If adding one requires a code deploy, the model is hardcoded and ops is blocked on engineering.

**Detection:** deploys required per new category (target 0); time-to-fix for a bad alias.

---

### D-08 — Category resolution must be deterministic, not model-inferred
**Severity:** P1 · **Horizon:** Scale

If routing depends on LLM output, every routing bug becomes a prompt-engineering session. LLM extracts items; a controlled lookup table resolves category and merchant.

---

## 6. Merchant adoption and operations

### M-01 — Confirm latency during rush hour
**Severity:** P0 · **Horizon:** Pilot

Orders arrive exactly when the merchant is weighing dal with six people queued. If median confirm latency is 20 minutes, the product may not be useful to anyone.

**Detection:** **median and p90 merchant confirm latency.** Kill threshold: median >10 min sustained.

---

### M-02 — Notification ignore rate
**Severity:** P0 · **Horizon:** Pilot

If merchants ignore 30% of notifications, does the product still function or collapse? Determines how much of the escalation ladder is load-bearing.

**Detection:** acknowledge rate within 5 min; % never acknowledged.

---

### M-03 — Do not build a native merchant app for v1
**Severity:** P1 · **Horizon:** MVP

Merchants live in WhatsApp and abandon apps. A native app adds "install it, learn it, check it during rush hour" on top of every other adoption ask. WhatsApp Business API with Confirm/Edit/Reject buttons covers the operational surface; React dashboard is for low-frequency history and analytics only.

**Cutting the app from v1 is the highest-leverage scope decision available.**

---

### M-04 — Accuracy floor before the product is net-negative
**Severity:** P0 · **Horizon:** Pilot

Ten orders/day with two quantity errors may cost the merchant more in goodwill than the product earns him.

**Detection:** order-capture accuracy (item + quantity), human-audited. **Target >92%. Kill threshold <85%.**

---

### M-05 — AI must disclose it is an AI
**Severity:** P1 · **Horizon:** MVP

A customer who believes they spoke to the shopkeeper blames the shopkeeper for errors. Open with shop name + assistant disclosure. Also a live regulatory expectation around synthetic voice.

---

### M-06 — Transfer-to-human path
**Severity:** P2 · **Horizon:** Pilot

"Main Sharmaji se baat karna chahta hoon." Needs a defined path — transfer, callback promise, or graceful decline — and each has a cost when the merchant is mid-transaction.

---

### M-07 — Closed-shop and out-of-hours handling
**Severity:** P2 · **Horizon:** MVP

Decide: take the order for tomorrow, or decline politely? Belongs in the webhook, before an agent session is created.

---

### M-08 — Abuse, pranks and fake COD orders
**Severity:** P1 · **Horizon:** Pilot

Every public phone number attracts prank calls. Fake COD orders cost the merchant real goods and real delivery time.

**Mitigation:** caller blocklist, rate limiting per number, first-order value caps, merchant-visible "new customer" flag.

**Detection:** orders per unknown number per day; merchant-reported fake-order rate.

---

## 7. Compliance and legal

| ID | Risk | Severity |
|---|---|---|
| C-01 | VoIP↔PSTN interconnect requires UL/VNO licensing in India — see [T-09](#t-09--india-telephony-compliance) | P0 |
| C-02 | DPDP Act: consent, purpose limitation, retention for call recordings and captured phone numbers | P0 |
| C-03 | Synthetic-voice disclosure expectations | P1 |
| C-04 | TRAI DND / commercial-communication rules on any outbound leg (escalation calls, callbacks, marketing) | P1 |
| C-05 | Per-number KYC obligations at DID scale | P1 |
| C-06 | Liability allocation between platform and merchant for mis-captured orders — must be in the merchant contract | P1 |
| C-07 | Recording consent announced at call start, in the caller's language | P1 |

---

## 8. Unit economics

**Indicative per-call cost at ~3 minutes:**

| Component | Lean stack | Premium stack |
|---|---|---|
| Telephony | ₹1–2 | ₹1–2 |
| ASR (streaming) | ~₹1.5 | ~₹1.5 |
| LLM | ~₹0.2 | ~₹0.5 |
| TTS | ~₹1 | ~₹15 |
| LiveKit | ~₹1 | ~₹1 |
| **Total** | **~₹5** | **~₹20** |

**E-01 — Subscription pricing is dead on arrival.** *P0.* A merchant taking 30 calls/day burns ₹4,500/month at lean-stack cost. Kirana software willingness-to-pay is ₹300–500/month. Pricing must be **per-completed-order, ₹3–8**, against a ₹350–500 AOV.

**E-02 — Call duration is gross margin.** *P0.* Every additional 30 seconds is a direct margin hit. This makes returning-customer shortcuts ("wahi pichla order?" → 25 s call) a survival feature, not a nice-to-have — and makes [L-15](#l-15--ellipsis-and-context-dependent-orders) and customer identity commercially, not just experientially, important.
**Detection:** average and p90 call duration; **contribution margin per completed order.**

**E-03 — Browse calls with no order.** *P1.* Caller talks for six minutes and orders nothing. Full cost, zero revenue.
**Detection:** no-order call rate; cost of non-converting calls as % of total spend.

**E-04 — Asking for a phone number costs ~15 s of margin on every call where it fires.** *P2.* Justifies investment in [T-02](#t-02--caller-id-is-unreliable-through-call-forwarding) resolution.

**E-05 — Fixed per-merchant costs.** *P1.* DID rental, WhatsApp conversation fees, minimum infrastructure. A merchant doing 15 orders/month may never cover them.
**Detection:** contribution margin per merchant; % of merchants below breakeven.

**E-06 — Premium TTS is not affordable at volume.** *P2.* ElevenLabs-class TTS quadruples per-call cost. Use Indic-native vendors (Sarvam Bulbul, Google Indic) — which is also the right call for [L-14](#l-14--tts-accent-and-register-mismatch).

---

## 9. Metrics catalogue

### 9.1 Product health (weekly review)

| Metric | Definition | Target | Kill threshold |
|---|---|---|---|
| Order capture accuracy | Item + quantity correct, human-audited sample | >92% | <85% |
| Quantity edit rate | % orders where merchant edits quantity | <8% | >20% |
| Item edit rate | % orders where merchant edits item/brand | <10% | >25% |
| Call completion rate | Calls producing a captured order | >70% | <50% |
| Early hang-up rate | Hang-ups within 10 s of AI greeting | <15% | >35% |
| Merchant confirm rate (5 min) | Orders acknowledged within 5 min | >75% | <40% |
| Median confirm latency | Order created → merchant action | <5 min | >10 min |
| Repeat caller rate | Callers with ≥2 orders in 30 days | >35% | — |
| Order fulfilment rate | Confirmed orders actually delivered | >95% | <85% |

### 9.2 Language and speech (segment everything)

> Aggregate numbers hide the failures that matter. Every metric here must be sliced by **language, dialect/locality, and speaker cohort**.

| Metric | Why it matters |
|---|---|
| WER — Hindi tokens | Core accuracy |
| WER — English/brand tokens | Code-mixing performance ([L-01](#l-01--code-mixing-is-the-default-not-the-exception)) |
| WER — Marathi tokens | Second-language coverage |
| WER by merchant locality | Dialect drift ([L-02](#l-02--dialect--language-and-mumbai-is-not-delhi)) |
| WER by estimated SNR | Acoustic robustness ([L-11](#l-11--acoustic-environment)) |
| Language-detection accuracy | Greeting correctness ([L-03](#l-03--you-do-not-know-the-language-until-the-caller-speaks)) |
| Language flips per call | >2 indicates ASR artifact ([L-04](#l-04--mid-call-language-switching)) |
| Unresolved quantity-token rate | Normalisation coverage ([L-05](#l-05--non-metric-and-colloquial-quantities)) |
| Unmatched item-string count/week | Alias-table backlog ([L-08](#l-08--regional-item-names-for-the-same-product)) |
| Wrong-item rate vs unmatched rate | Fuzzy-match tuning pair ([L-09](#l-09--fuzzy-matching-false-positives)) |
| DTMF vs speech success on digits | Phone capture reliability ([L-10](#l-10--digit-strings-over-voice-are-unreliable)) |
| Turn-truncation rate | Endpointing too aggressive for elderly speakers ([L-12](#l-12--elderly-and-atypical-speech)) |
| False barge-in rate | Backchannel misclassified ([L-13](#l-13--barge-in-and-turn-taking)) |
| Completion rate by TTS voice | Voice/register fit ([L-14](#l-14--tts-accent-and-register-mismatch)) |
| Schema-violation rate by language | Prompt drift ([L-16](#l-16--prompt-and-schema-drift-across-languages)) |

### 9.3 Technical

| Metric | Target |
|---|---|
| Voice-to-voice latency p95 | <1.2 s |
| — endpointing / VAD | <300 ms |
| — ASR finalisation | <300 ms |
| — LLM | <400 ms |
| — TTS first byte | <300 ms |
| Webhook response p99 | <300 ms |
| Fallback-TwiML invocation rate | <1% |
| Concurrent sessions per worker | Measured, not assumed |
| Calls dropped during deploy | 0 |
| Duplicate notifications | 0 |
| Orphaned orders (reconciliation) | 0 |
| Vendor throttle/429 rate | 0 |
| Peak concurrent calls | Tracked vs vendor caps |

### 9.4 Identity resolution

| Metric | Why |
|---|---|
| % orders with customer number from SIP headers | Decides forwarding vs DID ([T-02](#t-02--caller-id-is-unreliable-through-call-forwarding), [T-03](#t-03--provisioned-did-solves-identity-but-creates-an-adoption-problem)) |
| % from merchant confirmation card | Fallback load |
| % from in-call capture | Margin cost ([E-04](#8-unit-economics)) |
| % with no number at all | Fulfilment risk |
| Merchant-number-as-customer detections | Silent-corruption guard — should be caught 100% |

### 9.5 Operational

| Metric | Why |
|---|---|
| Calls received per merchant per week | Forwarding-health alert, drop-to-zero ([T-04](#t-04--forwarding-is-configured-on-the-merchants-handset-and-cannot-be-verified-remotely)) |
| Merchants onboarded with zero field visits | CAC viability ([D-06](#d-06--item-list-is-the-onboarding-bottleneck)) |
| Human hours per merchant onboarded | Business vs services test |
| Customer migration rate to new DID (30d) | DID topology viability ([T-03](#t-03--provisioned-did-solves-identity-but-creates-an-adoption-problem)) |
| Merchant churn, monthly | Product-market fit |
| Support tickets per merchant per month | Ops load |

### 9.6 Economic

| Metric | Why |
|---|---|
| Cost per call | Core |
| Cost per completed order | Core |
| Contribution margin per order | [E-02](#8-unit-economics) |
| Average / p90 call duration | Margin driver |
| No-order call rate | Wasted spend ([E-03](#8-unit-economics)) |
| Contribution margin per merchant | [E-05](#8-unit-economics) |
| % merchants below breakeven | Pricing model validity |

---

## 10. Open decisions

| # | Decision | Blocked on | Owner | Status |
|---|---|---|---|---|
| 1 | Forwarding vs provisioned DID (or per-merchant hybrid) | Carrier matrix test ([T-02](#t-02--caller-id-is-unreliable-through-call-forwarding)) + migration rate ([T-03](#t-03--provisioned-did-solves-identity-but-creates-an-adoption-problem)) | | Open |
| 2 | ASR vendor: Sarvam / Google Chirp / Bhashini | Eval on own recorded Hinglish corpus, telephony-band | | Open |
| 3 | Production telephony provider | Written compliance answers ([T-09](#t-09--india-telephony-compliance)) | | Open |
| 4 | Pricing: per-order rate | Merchant WTP test with real money ([B-02](#b-02--merchant-willingness-to-pay-is-near-zero-in-this-segment)) | | Open |
| 5 | Directory: build at all? | 50+ merchant density in one pin code ([B-07](#b-07--directory-is-a-decoy)) | | Deferred |
| 6 | Native merchant app | Evidence WhatsApp is insufficient ([M-03](#m-03--do-not-build-a-native-merchant-app-for-v1)) | | Deferred |
| 7 | Customer app / click-to-call for younger segment | Segment data ([B-04](#b-04--quick-commerce-substitution)) | | Deferred |

---

## 11. Pre-launch gate

Nothing below is optional. Each maps to a P0.

**Before writing further application code**
- [ ] Carrier matrix test complete — Jio/Airtel/Vi × forwarded/direct/withheld/landline, full INVITE headers captured ([T-02](#t-02--caller-id-is-unreliable-through-call-forwarding))
- [ ] 200 real order calls recorded with consent — eval corpus exists ([L-01](#l-01--code-mixing-is-the-default-not-the-exception), [B-06](#b-06--no-moat))
- [ ] ASR candidates benchmarked on that corpus at telephony bandwidth ([L-11](#l-11--acoustic-environment))
- [ ] Missed-call baseline measured in ≥5 shops ([B-03](#b-03--the-missed-call-problem-may-be-smaller-than-assumed))
- [ ] Vendor concurrency ceilings documented in writing ([S-02](#s-02--vendor-concurrency-limits-bite-before-infrastructure-does))

**Before first live merchant**
- [ ] `From == merchant number` guard implemented and tested ([T-02](#t-02--caller-id-is-unreliable-through-call-forwarding))
- [ ] Two-phase confirmation enforced; agent cannot assert price or availability ([B-01](#b-01--no-inventory-system-means-the-ai-cannot-confirm-anything))
- [ ] Quantity normalisation table deterministic, with unresolved-token flagging ([L-05](#l-05--non-metric-and-colloquial-quantities))
- [ ] Transactional outbox + idempotency keys on notifications ([S-05](#s-05--notification-fan-out-retries-and-idempotency))
- [ ] Escalation ladder live ([S-06](#s-06--escalation-ladder-for-unacknowledged-orders))
- [ ] Fallback TwiML on webhook failure ([T-06](#t-06--webhook-sits-synchronously-in-the-call-path))
- [ ] AI disclosure in greeting, per language ([M-05](#m-05--ai-must-disclose-it-is-an-ai))
- [ ] Recording consent announcement ([C-07](#7-compliance-and-legal))
- [ ] Customer entity keyed on internal ID, not phone number ([D-01](#d-01--customer-identity-must-not-be-keyed-on-phone-number))
- [ ] Per-call trace with turn-level latency breakdown ([S-11](#s-11--observability))
- [ ] Forwarding-health alert (calls/merchant/week → 0) ([T-04](#t-04--forwarding-is-configured-on-the-merchants-handset-and-cannot-be-verified-remotely))

**Before scaling past 50 merchants**
- [ ] Telephony provider abstraction proven by a real swap test ([T-09](#t-09--india-telephony-compliance))
- [ ] Graceful drain and predictive scale-up verified under peak simulation ([S-01](#s-01--agent-workers-scale-on-concurrent-calls-not-rps))
- [ ] Alias/category table editable by non-engineers without deploy ([D-07](#d-07--aliascategory-table-must-be-editable-without-a-deploy))
- [ ] Self-service onboarding with zero field visits demonstrated ([D-06](#d-06--item-list-is-the-onboarding-bottleneck))
- [ ] Contribution margin per order positive at realistic call duration ([E-02](#8-unit-economics))
- [ ] Parent/sub-order data model in place even if unused ([S-10](#s-10--multi-merchant-order-fan-out-directory-phase))

---

## Appendix — the five questions this document does not answer

These are business validations, not engineering problems. No amount of architecture substitutes for them.

1. Does a merchant pay real money per order, having tried it?
2. What fraction of customers hang up when an AI answers instead of the shopkeeper?
3. Will a customer who has dialled one number for a decade dial a different one?
4. Is the missed-call volume large enough to matter?
5. Would the target customer send a WhatsApp voice note instead — making the telephony stack optional?

"""LiveKit room voice agent — Sharma Kirana Store conversation prompt.

Not the same thing as VoiceAgent in this package's __init__.py: that one is a
synchronous CLI loop over a local mic + local Whisper model. This is a
long-running LiveKit job worker that joins whatever room a browser client
connects to (via apps/frontend's /call/[merchantId] screen or the
/dev/voice-call harness) and role-plays a single merchant's assistant using
Google's Gemini LLM with Deepgram STT and Inworld TTS. It captures order intent
conversationally only — no tool calls, no backend writes, nothing persisted.
Every merchant currently routes into this same room-join logic, but the prompt
below is hardcoded to Sharma Kirana Store (apps/frontend/src/lib/dummyData.ts's
`m1`, the default merchant in both entry points); it does not read the
merchantId/merchantName already attached to the caller's token attributes
(apps/frontend/src/app/api/livekit/token/route.ts) to vary by shop. See
apps/frontend/CLAUDE.md's "LiveKit voice call" section and the plan this came
from for what's deliberately deferred.

Needs GOOGLE_API_KEY, DEEPGRAM_API_KEY, and INWORLD_API_KEY in apps/agents/.env
(see .env.example) — separate from OPENAI_API_KEY/ANTHROPIC_API_KEY, which back
the text-only ChatAgent/SupervisorAgent, not this file.

Run with: uv run python -m agents.voice.livekit_agent dev
"""

import logging

from livekit import agents
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, inference
from livekit.plugins.deepgram import STT

from agents.config import settings

logger = logging.getLogger(__name__)

MERCHANT_NAME = "Sharma Kirana Store"

# docs/shopassist-risk-register.md guardrails, kept even though this agent
# doesn't persist anything yet:
# - M-05: disclose the shop name + that you're an AI, before anything else.
# - B-01: this agent has no inventory or pricing to check against — it must
#   capture intent only, never assert an order is confirmed, priced, or in
#   stock (that's the merchant's call downstream).
# - L-05/L-06: quantity errors are the highest-cost error class, and
#   colloquial quantities (paav, adha, sawa, dedh, dhai...) don't map
#   directly to numbers — capture the caller's own words verbatim rather
#   than converting units yourself, and always read the order back before
#   ending the call.
INSTRUCTIONS = (
    f"You are the AI voice assistant for {MERCHANT_NAME}, a kirana (grocery) "
    f"shop. Open the call by saying you're an AI assistant for "
    f"{MERCHANT_NAME}, not the shopkeeper. "
    "The caller may speak Hindi, Marathi, English, or a mix — follow "
    "whichever language(s) they use. "
    "Ask what they'd like to order. For each item, capture the item name and "
    "quantity exactly as the caller says them, including colloquial "
    "quantities like 'paav', 'adha', 'sawa', 'dedh', or 'dhai' — do not "
    "convert units or guess a number yourself. "
    "Never tell the caller a price, confirm stock, or say the order is "
    "confirmed — you cannot see the shop's inventory or prices. Tell them "
    "the shop will review and confirm the order. "
    "Before ending the call, read back every item and quantity you captured "
    "so the caller can correct anything you misheard."
)


async def entrypoint(ctx: JobContext) -> None:
    logger.info("entry point interred")
    await ctx.connect()

    logger.info(f"room info-{ctx._info.url} + {ctx.room.name}")
    session = AgentSession(
        stt=STT(
            model="nova-3",
            language="multi",
            api_key=settings.DEEPGRAM_API_KEY,
        ),
        llm="moonshotai/kimi-k2.6",
        tts=inference.TTS(model="inworld/inworld-tts-2-flash", voice="Riya", language="hi"),
    )
    await session.start(agent=Agent(instructions=INSTRUCTIONS), room=ctx.room)


if __name__ == "__main__":
    agents.cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            ws_url=settings.LIVEKIT_URL,
            api_key=settings.LIVEKIT_API_KEY,
            api_secret=settings.LIVEKIT_API_SECRET,
        )
    )

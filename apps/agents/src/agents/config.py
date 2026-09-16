from pydantic_settings import BaseSettings
from typing import List, Optional
from pathlib import Path


class AgentSettings(BaseSettings):
    APP_NAME: str = "Shop Assist Agents"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # LLM Configuration
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    DEFAULT_LLM_PROVIDER: str = "openai"
    DEFAULT_MODEL: str = "gpt-4-turbo-preview"
    DEFAULT_TEMPERATURE: float = 0.7
    MAX_TOKENS: int = 4096

    # Backend API
    BACKEND_API_URL: str = "http://localhost:8000/api/v1"
    BACKEND_API_KEY: str = ""

    # LiveKit — voice agent worker registration (src/agents/voice/livekit_agent.py).
    # Same LiveKit Cloud project as apps/frontend/.env, which mints room tokens
    # for browsers; these three register this process as a job worker instead.
    LIVEKIT_URL: str = ""
    LIVEKIT_API_KEY: str = ""
    LIVEKIT_API_SECRET: str = ""

    # Google Gemini — Live API used by the LiveKit voice agent for speech-to-speech
    # (separate from OPENAI_API_KEY/ANTHROPIC_API_KEY above, which back the
    # text-only ChatAgent/SupervisorAgent).
    GOOGLE_API_KEY: str = ""

    # Deepgram — STT/TTS for LiveKit voice agent
    DEEPGRAM_API_KEY: str = ""

    # Inworld — TTS for LiveKit voice agent
    INWORLD_API_KEY: str = ""

    # Redis/Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # Voice
    WHISPER_MODEL: str = "base"
    SAMPLE_RATE: int = 16000
    CHANNELS: int = 1
    CHUNK_SIZE: int = 1024

    # Agent Behavior
    MAX_ITERATIONS: int = 10
    AGENT_TIMEOUT: int = 300
    ENABLE_STREAMING: bool = True

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = AgentSettings()

# Base paths
BASE_DIR = Path(__file__).parent.parent.parent
CONFIG_DIR = BASE_DIR / "config"
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(exist_ok=True)
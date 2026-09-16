# syntax=docker/dockerfile:1

###############################################################################
# Builder: install locked deps + project wheel into a throwaway venv
###############################################################################
FROM python:3.11-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY apps/backend/pyproject.toml apps/backend/uv.lock ./

RUN pip install --no-cache-dir uv \
    && uv sync --frozen --no-dev --no-install-project

###############################################################################
# Runner: slim runtime with nothing but the venv and app source
###############################################################################
FROM python:3.11-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

RUN groupadd --system app \
    && useradd --system --gid app --home-dir /app app

COPY --from=builder /app/.venv ./.venv
COPY apps/backend/app ./app

USER app

EXPOSE 8000

# Runtime env vars come from the deployment environment (GitHub Actions
# secrets / compose / k8s), NOT from the image. Required at runtime:
#   DATABASE_URL, SECRET_KEY, CORS_ORIGINS
# Optional with defaults in app/core/config.py:
#   APP_NAME, APP_VERSION, DEBUG, API_V1_PREFIX, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
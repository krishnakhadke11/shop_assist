# Shop Assist - Monorepo Boilerplate

A full-stack monorepo boilerplate with Next.js frontend, FastAPI backend, AI Agents, and uv for Python package management.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: FastAPI, SQLAlchemy 2.0 (Async), PostgreSQL, Alembic
- **Agents**: Python 3.11+, LangChain, LangGraph, OpenAI/Anthropic, Whisper, Celery
- **Package Manager**: npm (Node.js), uv (Python)
- **Development**: Docker Compose, hot reload for all services

## Project Structure

```
shop-assist/
├── apps/
│   ├── frontend/          # Next.js application
│   │   ├── src/
│   │   │   ├── app/       # App Router pages
│   │   │   ├── components/
│   │   │   ├── lib/       # Utilities (API client)
│   │   │   └── types/     # TypeScript types
│   │   └── package.json
│   │
│   ├── backend/           # FastAPI application
│   │   ├── app/
│   │   │   ├── api/v1/    # API routes
│   │   │   ├── core/      # Configuration
│   │   │   ├── db/        # Database session
│   │   │   ├── models/    # SQLAlchemy models
│   │   │   ├── schemas/   # Pydantic schemas
│   │   │   └── services/  # Business logic
│   │   ├── alembic/       # Database migrations
│   │   ├── pyproject.toml
│   │   └── package.json
│   │
│   └── agents/            # AI Agents (Voice, Chat, Tasks)
│       ├── src/agents/
│       │   ├── base/      # Base agent classes, LLM client, API client
│       │   ├── voice/     # Voice agent with Whisper
│       │   ├── chat/      # Chat agent with tools
│       │   ├── tasks/     # Celery background tasks
│       │   └── config.py  # Agent settings
│       ├── tests/
│       ├── pyproject.toml
│       ├── package.json
│       └── Dockerfile
│
├── docker-compose.yml
├── package.json           # Root workspace config
└── .gitignore
```

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- uv (`pip install uv`)
- Docker & Docker Compose (optional)
- OpenAI API key (for agents)
- Anthropic API key (optional, for Claude)

### Option 1: Docker Compose (Recommended)

```bash
# Copy environment file for agents
cp apps/agents/.env.example apps/agents/.env
# Edit .env with your API keys

# Start all services (including agents, redis)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/api/v1/docs
- Redis: localhost:6379

### Option 2: Local Development

#### Backend Setup

```bash
cd apps/backend

# Copy environment file
cp .env.example .env

# Install dependencies with uv
uv sync

# Run database migrations
uv run alembic upgrade head

# Start development server
npm run dev
```

#### Frontend Setup

```bash
cd apps/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

#### Agents Setup

```bash
cd apps/agents

# Copy environment file
cp .env.example .env
# Edit .env with your OPENAI_API_KEY

# Install dependencies with uv
uv sync

# Start interactive agent (voice + chat)
npm run dev

# Or start specific agent
npm run dev:voice    # Voice agent
npm run dev:chat     # Chat agent

# Start Celery worker for background tasks
npm run dev:worker

# Start Celery beat for scheduled tasks
npm run dev:beat
```

#### Run All Together (from root)

```bash
# Install root dependencies
npm install

# Start frontend + backend
npm run dev

# Start all three (frontend + backend + agents)
npm run dev:all
```

## Available Scripts

### Root Level

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + backend |
| `npm run dev:all` | Start frontend + backend + agents |
| `npm run dev:frontend` | Start only frontend |
| `npm run dev:backend` | Start only backend |
| `npm run dev:agents` | Start agents (interactive) |
| `npm run dev:agents:voice` | Start voice agent |
| `npm run dev:agents:chat` | Start chat agent |
| `npm run dev:agents:worker` | Start Celery worker |
| `npm run build` | Build all workspaces |
| `npm run lint` | Lint all workspaces |
| `npm run typecheck` | Type check all workspaces |
| `npm run test` | Run tests for all workspaces |
| `npm run docker:up` | Start all Docker services |
| `npm run docker:down` | Stop all Docker services |
| `npm run docker:logs` | View Docker logs |
| `npm run docker:build` | Build Docker images |

### Backend (apps/backend)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start FastAPI with hot reload |
| `npm run lint` | Run ruff + mypy |
| `npm run format` | Format with ruff + isort |
| `npm run test` | Run pytest |
| `npm run db:makemigrations "message"` | Create new migration |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Open database GUI |

### Frontend (apps/frontend)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript check |
| `npm run test` | Run Jest tests |

### Agents (apps/agents)

| Command | Description |
|---------|-------------|
| `npm run dev` | Interactive mode (voice + chat) |
| `npm run dev:voice` | Voice agent with microphone |
| `npm run dev:chat` | Text chat agent |
| `npm run dev:worker` | Celery worker for background tasks |
| `npm run dev:beat` | Celery beat scheduler |
| `npm run lint` | Run ruff + mypy |
| `npm run format` | Format with ruff + isort |
| `npm run typecheck` | Run mypy |
| `npm run test` | Run pytest |
| `npm run test:coverage` | Run tests with coverage report |

## Environment Variables

### Backend (.env)

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/shop_assist
SECRET_KEY=your-secret-key-min-32-chars
CORS_ORIGINS=["http://localhost:3000"]
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Agents (.env)

```env
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
BACKEND_API_URL=http://localhost:8000/api/v1
REDIS_URL=redis://localhost:6379/0
WHISPER_MODEL=base
LOG_LEVEL=INFO
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/products` | List all products |
| GET | `/api/v1/products/{id}` | Get product by ID |
| POST | `/api/v1/products` | Create new product |
| PATCH | `/api/v1/products/{id}` | Update product |
| DELETE | `/api/v1/products/{id}` | Delete product |

## Agents

### Voice Agent
- Real-time speech-to-text using OpenAI Whisper
- Text-to-speech ready (add TTS integration)
- Continuous listening mode
- Tool calling for product operations

### Chat Agent
- Text-based conversation
- Tools: search_products, get_product_details, create_product
- Conversation history management
- Streaming responses

### Task Agent (Celery)
- Background voice message processing
- Batch product analysis
- Scheduled tasks via Celery Beat
- Redis-backed queue

## Adding New Features

### Backend

1. Create model in `app/models/`
2. Create schemas in `app/schemas/`
3. Create API routes in `app/api/v1/`
4. Run `npm run db:makemigrations "description"`
5. Run `npm run db:migrate`

### Frontend

1. Add types in `src/types/`
2. Create components in `src/components/`
3. Add pages in `src/app/`

### Agents

1. Create new tool in `src/agents/chat/` or `src/agents/voice/`
2. Add tool to agent's tool list
3. For background tasks, add to `src/agents/tasks/`

## Code Quality

- **Python**: ruff (linting), mypy (type checking), black (formatting), isort (imports)
- **TypeScript**: ESLint, TypeScript strict mode
- **Git Hooks**: Consider adding husky + lint-staged

## Voice Agent Requirements

For voice agent to work locally:
- macOS: `brew install portaudio`
- Linux: `apt-get install portaudio19-dev`
- Windows: Install PortAudio from http://www.portaudio.com/

For Docker, the Dockerfile includes necessary audio dependencies.

## License

MIT
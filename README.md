# Data Room

Data Room is a secure document workspace for teams to organise, preview, and share files inside dedicated data rooms. The repository is a monorepo that pairs a React single-page application with a Flask API backend connected to Supabase for authentication, PostgreSQL, and file storage.

## Table of Contents
- [Highlights](#highlights)
- [Tech Stack](#tech-stack)
- [Monorepo Layout](#monorepo-layout)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Database & Persistence](#database--persistence)
- [Optional Integrations](#optional-integrations)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Additional Documentation](#additional-documentation)

## Highlights
- Supabase-authenticated login with Google OAuth and automatic user bootstrap on the backend.
- Hierarchical data-room and folder tree with contextual actions and optimistic updates powered by TanStack Query.
- Direct-to-storage uploads and secure signed URLs served from Supabase Storage.
- Rich file previews for PDFs, Office documents (via online viewers), and images.
- Google Drive import utilities for bringing external documents into a data room.
- Performance-aware Flask API with connection pooling, request timing, and cache-aware invalidation helpers.
- Monorepo developer experience: one command boots both services, and shared utilities live alongside each subsystem.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, React Router v7, TanStack Query 5, Tailwind CSS, Radix UI primitives, CRACO/CRA tooling |
| Backend | Python 3.9+, Flask 3, SQLAlchemy 2, Marshmallow, Supabase Python client |
| Authentication | Supabase Auth (Google OAuth) with JWT validation inside Flask |
| Persistence | Supabase PostgreSQL + SQLAlchemy ORM models |
| File storage | Supabase Storage (`data-room-files` bucket) with signed upload/download URLs |
| Optional services | Redis (tag-based cache), Google Drive API |
| Tooling | npm scripts with `concurrently`, pytest (planned), React Testing Library + Jest |

## Monorepo Layout

```
data-room/
├── frontend/           # React SPA (CRA + CRACO)
│   ├── src/            # Components, hooks, contexts, pages, utils
│   ├── public/
│   └── env.example
├── backend/            # Flask API
│   ├── routes/         # Blueprint modules
│   ├── middleware/     # Auth, error handling, instrumentation
│   ├── services/       # Google Drive integration
│   ├── utils/          # Caching, validation, Supabase helpers
│   ├── models.py
│   ├── config.py
│   └── env.example
├── old_backend/        # Legacy Node/Prisma implementation (still used for Prisma tooling)
├── package.json        # Root scripts (`npm run dev`, etc.)
├── README.md
└── ARCHITECTURE.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+ (ships with Node 18)
- Python 3.9+ with `pip`
- Supabase project (database, auth, storage)
- Optional: Redis 6+ for distributed caching, Google Cloud project for Drive integration

### 1. Clone the repository

```bash
git clone <repository-url>
cd data-room
```

### 2. Install dependencies

```bash
npm install                 # installs root-level tooling (concurrently, dotenv-cli)
cd frontend && npm install  # install SPA dependencies
cd ../backend
python -m venv .venv        # optional but recommended
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure environment

Copy the example files and adjust the values from your Supabase and Google Cloud projects.

```bash
cp backend/env.example backend/.env
cp frontend/env.example frontend/.env.local
```

Update:
- `backend/.env` with your Supabase connection string, service role key, allowed origins, and Google OAuth credentials (if using Drive).
- `frontend/.env.local` with Supabase public URL/anon key and the URL of the Flask API (`PYTHON_API_URL`).

Refer to [Environment Variables](#environment-variables) for details.

## Environment Variables

| Location | Purpose | Required keys |
| --- | --- | --- |
| `backend/.env` | Flask configuration, Supabase credentials, optional Redis/Drive | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ALLOWED_ORIGINS`, `FRONTEND_URL`, optional `GOOGLE_*`, `REDIS_URL` |
| `frontend/.env.local` | SPA runtime config | `PYTHON_API_URL`, `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, optional `REACT_APP_SITE_URL` |
| `old_backend/env.example` | Legacy Prisma tooling | Only needed if you still run the Node/Prisma stack |

Environment values are loaded via `python-dotenv` on the backend and CRA's env loading on the frontend. The CRACO config exposes `PYTHON_API_URL` without the `REACT_APP_` prefix so it can be used directly inside `src/lib/api.ts`.

## Running Locally

Run both services with one command from the repository root:

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001 (API served under `/api`)

To run them separately:

```bash
npm run dev:frontend   # from repository root
npm run dev:backend
```

The backend automatically creates tables on first run (`db.create_all()`). Confirm your Supabase database allows connections from your IP.

## Database & Persistence

- SQLAlchemy models live in `backend/models.py` and map to Supabase PostgreSQL tables (`users`, `data_rooms`, `folders`, `files`, `google_drive_tokens`).
- Connection pooling and timeouts are tuned in `backend/config.py` for Supabase session vs transaction ports. `Config.validate()` raises on missing critical env keys.
- Database migrations are not yet automated for the Flask backend; Supabase tables are created on startup. The legacy `old_backend` directory still contains Prisma schema/scripts if you need migrations or introspection. Use the provided npm scripts (`npm run db:push`, etc.) against the Prisma schema when required.

## Optional Integrations

**Google Drive import**

- Enable the Drive API in Google Cloud, create OAuth credentials (web application), and add the backend callback URL (`http://localhost:3001/api/google-drive/callback` for local).
- Populate `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`.
- The frontend exposes connect/disconnect flows and Drive file pickers that call the Flask service in `backend/services/google_drive_service.py`.

**Caching**

- The backend ships with a tag-aware cache layer (`backend/utils/cache.py`) that prefers Redis but falls back to an in-memory store.
- Set `REDIS_URL`, `CACHE_ENABLED`, and optionally `CACHE_TTL` in `backend/.env`.
- See `backend/CACHING.md` for architecture and operational guide.

## Testing

- Frontend: `npm test` runs Jest + React Testing Library (configured in `frontend/package.json` and `craco.config.js`).
- Backend: pytest scaffolding is not included yet; add tests under `backend/tests` and run with `pytest` once configured.
- Linting: CRA's ESLint rules run with `npm test` or via your editor.

## Deployment

The project deploys cleanly to Vercel or any platform that supports static frontends and Python web services.

- **Frontend (Vercel)**
  - Root directory: `frontend`
  - Build command: `npm run build`
  - Output directory: `build`
  - Copy the variables from `frontend/.env.local` into Vercel project settings.

- **Backend (Vercel serverless or other)**
  - Root directory: `backend`
  - Install command: `pip install -r requirements.txt`
  - Start command: Configure a WSGI entrypoint (e.g., `gunicorn app:create_app()`) or adapt to the platform’s requirements.
  - Provide `DATABASE_URL`, Supabase keys, allowed origins, and Google/Redis credentials if used.

When deploying elsewhere (Railway, Fly, etc.), make sure the environment exposes the same variables and allows outbound connections to Supabase and Google APIs.

## Troubleshooting

- `401 Unauthorized`: confirm Supabase credentials and that the frontend sends the JWT via `Authorization` header (handled by `lib/api.ts` once `AuthContext` sets the token).
- Database timeouts: adjust pool sizes or switch to Supabase transaction pool (`:6543`) as recommended in `backend/env.example`.
- Google Drive OAuth redirect issues: ensure `GOOGLE_REDIRECT_URI` matches exactly in Google Cloud and the backend config.
- Missing env variables: the backend fails fast—check terminal logs when `Config.validate()` raises.

## Additional Documentation

- `ARCHITECTURE.md` — subsystem deep dive and sequence diagrams.
- `backend/CACHING.md` — cache architecture and operations.
- `backend/services/google_drive_service.py` — reference implementation for Drive import flow.
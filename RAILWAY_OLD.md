# Railway Deployment & GitHub Actions Playbook

A detailed, copyable guide for deploying a monorepo app to [Railway](https://railway.app) and wiring GitHub Actions the same way we run production services today.

**Audience:** an engineer standing up the same practices on another app  
**Stack assumed:** React/Vite (or similar) frontend + FastAPI (or similar) Python API + PostgreSQL, optionally MCP and AI sidecars  
**CD model:** Railway builds and deploys from GitHub; GitHub Actions is **CI only** (lint/test on PRs)

This playbook is intentionally concrete: topology, Dockerfile contracts, env matrices, dashboard steps, branch strategy, and a full annotated `ci.yml`. Adapt names (`myapp`, paths, package managers) to your repo; keep the principles.

**Critical Railway setting:** every GitHub-connected service must have the correct **Root Directory**. That path is the Docker build context. Wrong root → `COPY` failures or the wrong Dockerfile. See [§4](#4-monorepo--railway-service-mapping) before anything else.

| Railway service | Root Directory (set in dashboard) | Dockerfile (relative to that root) |
|---|---|---|
| `myapp-frontend` | `frontend` | `Dockerfile` |
| `myapp-api` | `backend/api_service` | `Dockerfile` |
| `myapp-ai` (optional) | `backend/ai_service` | `Dockerfile` |
| `myapp-mcp` (optional) | `backend/mcp_service` | `Dockerfile` |
| PostgreSQL | *(plugin — no Root Directory)* | — |

Do **not** set Root Directory to `backend/` for API/AI/MCP. Each Python service is an isolated build context: its own folder, its own `Dockerfile`, its own `pyproject.toml`.

---

## Table of contents

1. [Goals and design principles](#1-goals-and-design-principles)
2. [Topology](#2-topology)
3. [Why these choices](#3-why-these-choices)
4. [Monorepo → Railway service mapping](#4-monorepo--railway-service-mapping)
5. [Dockerfile conventions](#5-dockerfile-conventions)
6. [Port binding (`PORT`)](#6-port-binding-port)
7. [Database and schema deploy](#7-database-and-schema-deploy)
8. [Environment variables](#8-environment-variables)
9. [Frontend config: build-time vs runtime](#9-frontend-config-build-time-vs-runtime)
10. [Networking, CORS, and public URLs](#10-networking-cors-and-public-urls)
11. [Health checks](#11-health-checks)
12. [Step-by-step: create the Railway project](#12-step-by-step-create-the-railway-project)
13. [GitHub integration and deploy flow](#13-github-integration-and-deploy-flow)
14. [GitHub Actions (CI) in detail](#14-github-actions-ci-in-detail)
15. [CI vs CD: separation of concerns](#15-ci-vs-cd-separation-of-concerns)
16. [Branch and environment strategy](#16-branch-and-environment-strategy)
17. [Custom domains](#17-custom-domains)
18. [Secrets and operational hygiene](#18-secrets-and-operational-hygiene)
19. [Local parity (Docker build/run)](#19-local-parity-docker-buildrun)
20. [Verification checklist](#20-verification-checklist)
21. [Troubleshooting](#21-troubleshooting)
22. [Adapting this playbook to your app](#22-adapting-this-playbook-to-your-app)
23. [Reference checklist (files to create)](#23-reference-checklist-files-to-create)

---

## 1. Goals and design principles

| Principle | Practice |
|---|---|
| **One service = one container** | API, frontend, and optional MCP/AI are separate Railway services with their own Dockerfiles. Scale and restart independently. |
| **Dockerfile is the contract** | Prefer Dockerfile builds over Nixpacks. For each service, set **Root Directory** to that service’s folder (`frontend`, `backend/api_service`, …) and keep `Dockerfile` at that root (or set Dockerfile path relative to it). Optionally mirror in `railway.toml`—pick one approach and stick to it. |
| **Platform injects runtime facts** | Railway sets `PORT` and (when linked) `DATABASE_URL`. App settings read those first and fall back to local defaults. |
| **Idempotent boot migrations** | API (and any DB-touching service) runs schema deploy before the process listens. Safe to re-run; no separate migration job required for additive schema. |
| **Frontend URLs without rebuild when possible** | Prefer **runtime** injection of API/WebSocket base URLs over baking only `VITE_*` into the JS bundle. |
| **CI does not deploy** | GitHub Actions lint/test on PRs. Railway deploys from the connected branch. Do not put production secrets in Actions for this model. |
| **Optional AI stack** | Core product = Postgres + API + frontend. MCP + AI are optional services wired by env URLs. |

---

## 2. Topology

```
                    ┌─────────────────────────────────────────┐
                    │           Railway project                 │
                    │                                           │
 Browser ──HTTPS──► │  myapp-frontend  (static + serve)         │
                    │         │                                 │
                    │         │ APP_API_URL (HTTPS)              │
                    │         ▼                                 │
                    │  myapp-api  ◄──── DATABASE_URL ──────────► │── PostgreSQL addon
                    │         ▲                                 │
                    │         │ (optional in-process MCP)       │
 Browser ──WSS────► │  myapp-ai  ──SSE──► myapp-mcp             │
                    │                                           │
                    └─────────────────────────────────────────┘
```

| Service | Role | Listens | Talks to |
|---|---|---|---|
| **PostgreSQL** | Primary datastore | 5432 (internal) | Linked services via `DATABASE_URL` |
| **myapp-api** | REST API | `$PORT` (local default e.g. 8080) | Postgres |
| **myapp-frontend** | Built SPA served by a static server | `$PORT` (local default e.g. 3000) | Browser → API / AI via configured public URLs |
| **myapp-mcp** (optional) | MCP SSE wrapping API capabilities | `$PORT` | Postgres (same secrets as API); AI over SSE |
| **myapp-ai** (optional) | Agent WebSocket + LLM provider | `$PORT` | MCP SSE URL; CORS from frontend origin |

**Data path for AI turns (if used):** Browser → AI WebSocket → MCP `/sse` → in-process API routes → Postgres. The AI service should **not** own business logic or direct DB access.

---

## 3. Why these choices

### Why Railway

- Managed Postgres with one-click linking and auto-injected `DATABASE_URL`.
- Git-connected deploys without maintaining a deploy workflow in GitHub Actions.
- Native Docker builds from monorepo subdirectories.
- Public HTTPS (and WSS) URLs per service; optional custom domains.
- Private networking within a project so internal services (e.g. MCP) can stay less exposed.
- Environments (staging / production) with independent variables and domains.

### Dashboard config vs `railway.toml`

**Production practice:** set **Root Directory** (and optionally Dockerfile path) **in the Railway dashboard** for each service. Root Directory is not optional—Railway will not guess the correct monorepo subdirectory.

| Service | Dashboard → Settings → Root Directory |
|---|---|
| Frontend | `frontend` |
| API | `backend/api_service` |
| AI | `backend/ai_service` |
| MCP | `backend/mcp_service` |

**Optional alternative:** a `railway.toml` **inside each service’s Root Directory**. If you also set Root Directory in the dashboard, Railway still expects the config-as-code path as a **repo-absolute** path (it does not join to Root Directory), e.g. `/backend/api_service/railway.toml`.

```toml
# backend/api_service/railway.toml  (only if you choose file-based config)
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
healthcheckPath = "/health"
```

```toml
# frontend/railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
healthcheckPath = "/"
```

**Rule:** pick dashboard-only **or** `railway.toml`, not both with conflicting paths. Root Directory in the dashboard must still match the folder that contains the Dockerfile you intend to build.

### Why separate MCP and AI services

- AI workloads (LLM latency, streaming) scale separately from the REST API.
- MCP can be pointed at by IDE tooling (stdio locally) or by the AI service (SSE in prod).
- The API remains the single source of truth; MCP is a thin protocol adapter.

---

## 4. Monorepo → Railway service mapping

This is an **isolated monorepo**: each deployable service owns its own folder. Railway’s **Root Directory** for that service **must** be that folder. Railway only uses files under Root Directory as the Docker build context—anything outside it is invisible to `COPY`.

### 4.1 Required dashboard settings (per service)

Set all four for every GitHub-connected service:

1. **Root Directory** — Docker build context (paths below are relative to the repo root; no leading slash in the dashboard is fine: `backend/api_service`)
2. **Dockerfile path** — relative to that root (almost always `Dockerfile`)
3. **Watch paths** — gitignore-style; only rebuild when that service’s tree changes
4. **Branch** — which Git branch triggers deploys for this environment (`main` / `release`)

### 4.2 Root Directory cheat sheet

| Railway service | Root Directory | Dockerfile path | Watch paths | What lives in that folder |
|---|---|---|---|---|
| `myapp-frontend` | `frontend` | `Dockerfile` | `/frontend/**` | `package.json`, `src/`, runtime inject scripts, `Dockerfile` |
| `myapp-api` | `backend/api_service` | `Dockerfile` | `/backend/api_service/**` | `pyproject.toml`, `api.py` / package code, `lib/`, `scripts/`, `Dockerfile` |
| `myapp-ai` (optional) | `backend/ai_service` | `Dockerfile` | `/backend/ai_service/**` | `pyproject.toml`, `app.py` / agents, `Dockerfile` |
| `myapp-mcp` (optional) | `backend/mcp_service` | `Dockerfile` | `/backend/mcp_service/**` | `pyproject.toml`, MCP server, `Dockerfile` |
| PostgreSQL | — | — | — | Railway plugin; not built from the repo |

**Put these Root Directory values in the Railway UI exactly.** Common mistakes:

| Wrong Root Directory | Why it breaks |
|---|---|
| *(empty / repo root)* | Builds the wrong tree; may pick up no Dockerfile or the frontend’s |
| `backend` | API/AI/MCP Dockerfiles expect **their** folder as context; `COPY` paths and per-service `pyproject.toml` will not match |
| `backend/api_service/` for the AI service | Builds the API image for the AI service |
| `frontend` for the API | Builds the SPA for the API |

**Critical:** shared code the API needs (`lib/`, `scripts/`) must live **inside** `backend/api_service/` (or be vendored there). The API image cannot `COPY ../../something` from outside Root Directory.

### 4.3 Local builds must use the same context

Reproduce Railway exactly—context directory = Root Directory:

```bash
# API  — Root Directory = backend/api_service
docker build -t myapp-api backend/api_service

# AI   — Root Directory = backend/ai_service
docker build -t myapp-ai backend/ai_service

# MCP  — Root Directory = backend/mcp_service
docker build -t myapp-mcp backend/mcp_service

# Frontend — Root Directory = frontend
docker build -t myapp-frontend frontend
```

Equivalent Task targets should `cd` (or pass context) to those same directories—not to `backend/`.

---

## 5. Dockerfile conventions

Root Directory for these examples is the service folder itself (`backend/api_service`, etc.). The Dockerfile sits at that root and only `COPY`s paths inside it.

### 5.1 Python services (API / MCP / AI)

Shared pattern:

1. Base: `python:3.12-slim` (pin if your org requires it)
2. Install **uv** by copying the binary from `ghcr.io/astral-sh/uv:latest` (avoid apt-installing uv)
3. `uv pip install --system --no-cache -r pyproject.toml` (or `uv sync` into a venv—be consistent)
4. Copy only what that service needs from **its** Root Directory
5. Set `PYTHONUNBUFFERED=1` (and `PYTHONPATH` if needed)
6. Default `PORT` in the image; **CMD always uses `${PORT:-…}`** so Railway’s injected port wins
7. Docker `HEALTHCHECK` hitting a local HTTP endpoint on `$PORT`
8. Disable reload in production (`API_RELOAD=false` / equivalent)

**API** — Root Directory `backend/api_service`. Migrate then serve.

If the process is `uvicorn api_service.api:app`, the image needs a package directory named `api_service`. Copy the build-context contents into that package name:

```dockerfile
# Railway Root Directory = backend/api_service
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
COPY pyproject.toml ./
RUN uv pip install --system --no-cache -r pyproject.toml

COPY lib/ ./lib/
COPY scripts/ ./scripts/
COPY . ./api_service/

ENV PYTHONUNBUFFERED=1
ENV API_RELOAD=false

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import os; import urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/health')"

CMD ["sh", "-c", "python scripts/deploy_tables.py && uvicorn api_service.api:app --host 0.0.0.0 --port ${PORT:-8080}"]
```

**MCP** — Root Directory `backend/mcp_service`. Same idea; migrate then SSE server:

```dockerfile
# Railway Root Directory = backend/mcp_service
CMD ["sh", "-c", "python scripts/deploy_tables.py && python -m mcp_service.server --sse"]
```

**AI** — Root Directory `backend/ai_service`. No DB; just the app server:

```dockerfile
# Railway Root Directory = backend/ai_service
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
COPY pyproject.toml ./
RUN uv pip install --system --no-cache -r pyproject.toml

COPY . ./ai_service/

ENV PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import os; import urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/health')"

CMD ["sh", "-c", "uvicorn ai_service.app:app --host 0.0.0.0 --port ${PORT:-8001}"]
```

### 5.2 Frontend (multi-stage)

Root Directory `frontend`. Example with Bun + Vite (swap for Node/pnpm if that is your stack):

```dockerfile
# Railway Root Directory = frontend
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

ARG VITE_AI_WS_URL
ENV VITE_AI_WS_URL=$VITE_AI_WS_URL

COPY . .
RUN bun run build

FROM oven/bun:1-slim AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
COPY scripts/inject-runtime-config.ts /app/scripts/inject-runtime-config.ts
RUN chmod +x /docker-entrypoint.sh && bun add serve

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD bun -e "fetch('http://localhost:' + (process.env.PORT || '3000')).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/docker-entrypoint.sh"]
```

Entrypoint responsibilities:

1. Inject runtime config into `index.html` (or equivalent)
2. `exec` the static server on `0.0.0.0:${PORT:-3000}` with SPA fallback (`-s` / history API rewrite)

### 5.3 Practices to copy

- Prefer slim base images.
- Install package managers via copy-from official images rather than layering installers.
- Never hardcode Railway’s dynamic port—always bind to `$PORT`.
- Keep `HEALTHCHECK` in the Dockerfile so local `docker run` and Railway share probe semantics.
- Copy only required paths; do not bake `.env` secrets into images.
- Comment the intended Root Directory at the top of every Dockerfile so dashboard setup stays unambiguous.

---

## 6. Port binding (`PORT`)

Railway assigns a **dynamic** `PORT` env var per deployment and routes public traffic to it. Local defaults remain in the image for `docker run` without Railway.

| Service | Typical local default | How settings should resolve |
|---|---|---|
| API | 8080 | `int(os.environ.get("PORT") or "8080")` |
| MCP | 8090 | `PORT` overrides service-specific port env |
| AI | 8001 | `int(os.environ.get("PORT") or "8001")` |
| Frontend | 3000 | static server `… ${PORT:-3000}` |

**Do not** assume Railway will use your local defaults on the public URL. Always bind `0.0.0.0:$PORT`.

---

## 7. Database and schema deploy

### 7.1 Linking Postgres

1. Add Railway’s **PostgreSQL** plugin/addon to the project (per environment).
2. On **api** (and **mcp** if it shares the DB): use Railway’s variable reference / service connection so `DATABASE_URL` is injected.
3. Application code prefers `DATABASE_URL` over discrete `DB_HOST` / `DB_PORT` / etc.:

```python
@property
def database_url(self) -> str:
    env_url = os.environ.get("DATABASE_URL")
    if env_url:
        return env_url
    # fall back to DB_* for local Docker Postgres
    ...
```

Locally, leave `DATABASE_URL` empty and use `DB_*` in `.env.local`.

### 7.2 Idempotent schema on boot

A script such as `backend/api_service/scripts/deploy_tables.py` should:

1. `CREATE TABLE IF NOT EXISTS` for every table
2. Run additive `ALTER TABLE … IF NOT EXISTS` / nullability tweaks
3. Optional safe backfills

Wire it into the **API (and MCP) container CMD** before the server starts. Consequences:

- New deploys apply schema without a separate migration pipeline.
- Multiple services may both run deploy on start—must stay **idempotent**.
- Destructive reset flags (`--reset`) are **local-only**; never wire them into production CMD.

### 7.3 What this is not

This is **not** Alembic/Flyway with versioned down-migrations. Column renames/drops need careful manual SQL. For strict migration history, keep Railway wiring the same but replace boot schema deploy with a versioned migrator in CMD (still idempotent / forward-only in prod).

### 7.4 Connection pool

Use a small pool by default (e.g. `min_size=2`, `max_size=10`) and tune if you run many replicas against one Postgres.

---

## 8. Environment variables

Ship `.env.example` files per service that match Railway variable names.

### 8.1 API

| Variable | Source | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | Postgres link | Yes | Auto-injected when linked |
| `PORT` | Railway | Yes (auto) | Do not set manually unless debugging |
| `JWT_SECRET` | Manual | Yes | Strong random; must match MCP if used |
| `CREDENTIALS_ENCRYPTION_KEY` | Manual | If encrypting secrets at rest | Must match MCP if used |
| `FRONTEND_URL` | Manual | Yes | Exact frontend origin for CORS (no trailing-slash mismatch) |
| `API_PUBLIC_URL` | Manual | Yes if OAuth | Public API origin; OAuth callback base |
| OAuth client IDs/secrets | Manual | Optional | Callbacks under `{API_PUBLIC_URL}/…` |

### 8.2 MCP (optional)

Needs the **same** DB and auth secrets as the API if it loads the API in-process:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Link **same** Postgres as API |
| `JWT_SECRET` | Yes | Identical to API |
| `CREDENTIALS_ENCRYPTION_KEY` | If used | Identical to API |
| `FRONTEND_URL` | Recommended | CORS when app code path loads |
| `PORT` | Auto | Overrides local MCP port defaults |

### 8.3 AI (optional)

| Variable | Required | Notes |
|---|---|---|
| `AI_SERVICE_MCP_SERVER_URL` | Yes | e.g. `https://<mcp>.up.railway.app/sse` or private URL + `/sse` |
| `AI_SERVICE_API_SERVICE_URL` | Recommended | Documented / health; tools often go through MCP |
| `AI_SERVICE_OPENAI_API_KEY` (or provider key) | Yes for real model | Without it, degrade gracefully |
| `AI_SERVICE_FRONTEND_URL` | Yes in prod | Added to CORS allowlist |
| `AI_SERVICE_CORS_ORIGINS` | Optional | Comma-separated override |
| Reload flags | No | Keep `false` in prod |

Use a consistent env prefix (e.g. `AI_SERVICE_`) in settings.

### 8.4 Frontend

| Variable | When applied | Purpose |
|---|---|---|
| `APP_API_URL` (or `SHIPSHAPE_API_URL` / your brand prefix) | **Runtime** (container start) | Preferred: API base URL written into HTML/config |
| `APP_AI_WS_URL` | **Runtime** | Preferred: `wss://<ai>/agent/ws` |
| `VITE_API_URL` | **Build** | Fallback / bake into bundle |
| `VITE_AI_WS_URL` | **Build** | Fallback / bake into bundle |
| `PORT` | Runtime (auto) | Static server listen port |

**Recommendation:** Set runtime URL vars in Railway. Optionally also set `VITE_*` as build args. After deploy, View Source and confirm the runtime config object is not empty.

### 8.5 Variable references between services

In the Railway UI, prefer **references** to other services’ public URLs instead of hardcoding hostnames that change when you regenerate domains:

- Frontend `APP_API_URL` → API public URL  
- Frontend `APP_AI_WS_URL` → `wss://` + AI host + path  
- AI `AI_SERVICE_MCP_SERVER_URL` → MCP URL + `/sse`  
- API/MCP `FRONTEND_URL` → Frontend public origin  

---

## 9. Frontend config: build-time vs runtime

Vite (and most bundlers) only expose `import.meta.env.VITE_*` values that existed **at build time**. Changing a Railway env var does **not** update an already-built JS bundle unless you rebuild.

**Runtime hook pattern:**

1. Ship `index.html` with a placeholder:

   ```html
   <script>
     window.__APP_RUNTIME_CONFIG__ = {};
   </script>
   ```

2. On container start, an inject script rewrites that object from runtime env vars (falling back to `VITE_*`).

3. App config resolution order:

   1. `window.__APP_RUNTIME_CONFIG__`
   2. `import.meta.env.VITE_*`
   3. Dev fallbacks (`/api`, local WS path)

**Copy this pattern** for any SPA on Railway that needs environment-specific API hosts without rebuilding for every URL tweak.

---

## 10. Networking, CORS, and public URLs

### 10.1 Generate public domains

For each service that browsers or external clients call (frontend, API, AI; often MCP too), enable a Railway public domain under **Settings → Networking**.

| Client | Protocol | Target |
|---|---|---|
| Users | HTTPS | Frontend |
| Browser `fetch` | HTTPS | API |
| Browser WebSocket | WSS | AI |
| AI → MCP | HTTPS SSE | MCP (`…/sse`) |

Use `wss://` in production for WebSockets (not `ws://`).

### 10.2 CORS

- API allows `FRONTEND_URL` plus localhost origins for local dev.
- AI allows localhost + `AI_SERVICE_FRONTEND_URL`, or an explicit CORS list.

Mismatch between the browser’s origin and `FRONTEND_URL` is a common production footgun (trailing slashes, `www`, wrong scheme).

### 10.3 Private networking (optional)

If AI and MCP are in the same Railway project, point the MCP URL at the **private** hostname Railway provides, still ending in `/sse`. Frontend and API still need public HTTPS for browsers.

### 10.4 OAuth callbacks

Register provider redirect URLs using `API_PUBLIC_URL`. Update IdP console entries when the API public domain changes.

---

## 11. Health checks

| Service | Probe | Expected |
|---|---|---|
| API | `GET /health` | Healthy JSON |
| AI | `GET /health` | JSON including provider/MCP/CORS wiring |
| MCP | HTTP hit on `/sse` (or dedicated health) | Accepts connection |
| Frontend | HTTP GET `/` on `$PORT` | Static server responds |

Dockerfile `HEALTHCHECK` intervals are typically ~30s with retries. In Railway you can additionally set a healthcheck path on the service—keep it aligned with `/health` for API/AI.

Use AI `/health` after deploy to confirm env wiring without opening a WebSocket.

---

## 12. Step-by-step: create the Railway project

Replace `myapp` / names with your app’s.

### 12.1 Project and database

1. Create a Railway project (e.g. `myapp`).
2. Create environments you need (at least **staging**; add **production** when ready).
3. Add **PostgreSQL** to each environment that needs it.
4. Link Postgres only to services that need DB (API + MCP typically).

### 12.2 API service

1. **New service** → Deploy from GitHub repo (or empty + connect later).
2. **Root Directory:** `backend/api_service` ← required; do not use `backend`
3. **Builder:** Dockerfile (auto-detect `Dockerfile` in that root)
4. **Dockerfile path:** `Dockerfile` (relative to Root Directory)
5. **Watch paths:** `/backend/api_service/**`
6. **Variables:**
   - Link Postgres → `DATABASE_URL`
   - `JWT_SECRET`, encryption keys as needed
   - `FRONTEND_URL` (set after frontend domain exists; can iterate)
   - `API_PUBLIC_URL` (API’s own public HTTPS origin)
7. Generate a **public domain**.
8. Confirm deploy logs show schema deploy success, then the server listening.
9. `curl https://<api>/health`

### 12.3 Frontend service

1. **Root Directory:** `frontend`
2. **Dockerfile path:** `Dockerfile`
3. **Watch paths:** `/frontend/**`
4. Variables (runtime): API URL; AI WSS URL after AI exists
5. Optional build args: `VITE_API_URL`, `VITE_AI_WS_URL`
6. Public domain → set API `FRONTEND_URL` to this origin exactly
7. View page source → verify runtime config is populated

### 12.4 MCP service (optional)

1. **Root Directory:** `backend/mcp_service` (not `backend`)
2. **Dockerfile path:** `Dockerfile`
3. **Watch paths:** `/backend/mcp_service/**`
4. Link **same** Postgres; copy JWT/encryption/frontend secrets from API
5. Public or private domain; client path typically `/sse`

### 12.5 AI service (optional)

1. **Root Directory:** `backend/ai_service` (not `backend`)
2. **Dockerfile path:** `Dockerfile`
3. **Watch paths:** `/backend/ai_service/**`
4. Set MCP URL, API URL, provider key, frontend origin for CORS
5. Public domain for WSS
6. Update frontend AI WSS runtime var and restart frontend if needed

### 12.6 Wire order (recommended)

```text
Postgres → API → Frontend (API URL only)
         → MCP → AI → Frontend (add AI WSS) → tighten CORS on API/AI
```

---

## 13. GitHub integration and deploy flow

This is the **CD** half of the system. GitHub Actions does not push images to Railway in the default practice.

### 13.1 Connect the repo

1. In Railway: **Project → Settings → Connections** (or service → connect repo) → authorize GitHub.
2. Select the repository.
3. For each service, confirm:
   - **Root Directory** matches §4 (`frontend`, `backend/api_service`, `backend/ai_service`, `backend/mcp_service`)
   - **Dockerfile path** is `Dockerfile` relative to that root
   - **Watch paths** scoped to that service’s tree
   - **Branch** for this environment (e.g. staging watches `main`)
   - **Auto-deploy** enabled (or wait-for-CI if you enable that Railway option)

### 13.2 What triggers a rebuild

| Trigger | Effect |
|---|---|
| Push to the watched branch | Railway clones, builds Dockerfile, deploys |
| Env var change that requires redeploy | Restart / rebuild depending on var type |
| Manual **Redeploy** in dashboard | Rebuild or restart from existing image |
| Disconnect / reconnect repo | Reconfigure carefully; do not lose root/Dockerfile settings |

### 13.3 Build context notes

Each service builds **only** from its Root Directory. Railway still clones the repo, but files outside that directory are not in the Docker context. Keep everything a service needs under its Root Directory. Never `COPY` `.env`, credentials, or large unrelated trees into the image.

### 13.4 Wait for CI (optional Railway setting)

Some teams enable “wait for CI checks to pass” before Railway deploys. That is complementary to this playbook:

- GitHub Actions still only runs tests.
- Railway still performs the deploy.
- You avoid deploying commits that failed PR checks **if** you also deploy only after merge—or if Railway is configured to respect required checks on the branch tip.

**Default we use:** merge to `main` only with green required checks; Railway auto-deploys `main`. No Actions deploy job.

### 13.5 There is no GitHub Actions deploy job

Do **not** add `railway up` / `railway deploy` to Actions unless you have a deliberate reason (e.g. promote-only pipelines, multi-cloud). The reference practice is:

- **PR** → Actions CI  
- **Push to connected branch** → Railway CD  

---

## 14. GitHub Actions (CI) in detail

### 14.1 Goals of CI

| Goal | How |
|---|---|
| Block broken merges | Required status checks on `main` / `release` |
| Fast feedback | Path filters so only changed packages run |
| Deterministic installs | Frozen lockfiles (`uv sync`, `bun install --frozen-lockfile`) |
| No deploy / no prod secrets | Workflow never calls Railway; no `RAILWAY_TOKEN` in Actions |

### 14.2 Branch triggers

```yaml
on:
  pull_request:
    branches: [main, release]
```

- PRs targeting `main` or `release` run CI.
- Direct pushes to those branches do **not** need CI for deploy (Railway deploys), but branch protection should require green checks **before** merge so the tip Railway builds is already validated.

Optional additions you may want later (not required for parity):

```yaml
on:
  pull_request:
    branches: [main, release]
  push:
    branches: [main, release]   # re-run CI on the merged tip
  workflow_dispatch:            # manual re-run
```

### 14.3 Full annotated workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

# Only quality gates — Railway owns deploy.
on:
  pull_request:
    branches: [main, release]

jobs:
  # ─── Path filter: avoid running unrelated suites ───
  changes:
    name: Detect Changes
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.filter.outputs.backend }}
      frontend: ${{ steps.filter.outputs.frontend }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            backend:
              - 'backend/**'
            frontend:
              - 'frontend/**'

  # ─── Backend: lint + unit/integration tests ───
  backend-test:
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - uses: astral-sh/setup-uv@v4

      # Install deps from lock / pyproject (prefer frozen/locked when available)
      - run: uv sync --extra dev

      - run: uv run ruff check .
      - run: uv run ruff format --check .
      - run: uv run pytest tests/ -v

  # ─── Frontend: lint + typecheck + unit tests ───
  frontend-test:
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2

      - run: bun install --frozen-lockfile
      - run: bun run check        # e.g. Biome / ESLint
      - run: bun run typecheck
      - run: bun run test         # e.g. Vitest
```

### 14.4 Why path filters

Monorepos waste CI minutes if every PR runs every suite. `dorny/paths-filter` sets job `if:` conditions so a frontend-only PR skips backend pytest and vice versa. Docs-only PRs can skip both (both jobs `if: false`).

If a PR changes shared root files (e.g. `Taskfile.yml`, Docker compose) that affect both, either:

- Add those paths to **both** filters, or  
- Add a third `shared` filter that forces both jobs.

### 14.5 Branch protection (GitHub settings)

In GitHub → **Settings → Branches → Branch protection rules** for `main` (and `release`):

1. Require a pull request before merging  
2. Require status checks to pass — select `backend-test` and `frontend-test` (or a single aggregate if you add one)  
3. Note: path-filtered jobs that are **skipped** may need a always-green aggregator job if GitHub treats skipped required checks as blocking. Pattern:

```yaml
  ci-success:
    name: CI Success
    needs: [backend-test, frontend-test]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Verify required jobs
        run: |
          backend="${{ needs.backend-test.result }}"
          frontend="${{ needs.frontend-test.result }}"
          # success or skipped are OK; failure/cancelled are not
          for r in "$backend" "$frontend"; do
            case "$r" in
              success|skipped) ;;
              *) echo "Job result: $r"; exit 1 ;;
            esac
          done
```

Make **CI Success** the required check instead of the individual jobs.

### 14.6 Secrets in GitHub Actions

For this Railway model, Actions typically needs **no** deploy secrets:

| Secret | In Actions? | Where it belongs |
|---|---|---|
| `RAILWAY_TOKEN` | No (default) | Not needed; Railway GitHub app deploys |
| `DATABASE_URL` | Only if CI runs DB tests | Prefer ephemeral CI Postgres service, not prod |
| `JWT_SECRET` / API keys | No | Railway service variables |
| `OPENAI_API_KEY` | No | Railway AI service only |

If you add integration tests that need Postgres:

```yaml
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: myapp_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/myapp_test
```

### 14.7 Optional: Docker build smoke in CI

Not required for parity, but useful if Railway builds often fail on `COPY` mistakes:

```yaml
  docker-smoke:
    needs: changes
    if: needs.changes.outputs.backend == 'true' || needs.changes.outputs.frontend == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: Build API image
        if: needs.changes.outputs.backend == 'true'
        run: docker build -t myapp-api:ci backend/api_service
      - name: Build frontend image
        if: needs.changes.outputs.frontend == 'true'
        run: docker build -t myapp-frontend:ci frontend
```

Context directories above **must** match Railway Root Directory (`backend/api_service`, `frontend`). Building with `-f … -t … backend/` is the wrong model for this playbook.

Still **do not** push these images to Railway from Actions unless you intentionally change CD models.

### 14.8 What not to put in Actions

- `railway up` / deploy scripts as the primary CD path (duplicates Railway GitHub integration)
- Production `DATABASE_URL` or live API keys
- Unconditional full-monorepo installs on every docs-only PR (use path filters)
- Deploy-on-PR without an explicit preview-environment strategy

---

## 15. CI vs CD: separation of concerns

| Stage | Tool | Responsibility |
|---|---|---|
| PR quality gate | **GitHub Actions** | Lint, typecheck, unit/integration tests |
| Build & release | **Railway** | Docker build, migrate-on-boot, run containers |
| Schema | **Container CMD** | Idempotent `deploy_tables.py` (or migrator) |
| Secrets | **Railway variables** | Per environment / per service |

```text
  Developer
      │
      ▼
  Pull request ──► GitHub Actions (ci.yml) ──► required checks
      │
      ▼ (merge)
  main / release
      │
      ▼
  Railway GitHub integration ──► build Dockerfiles ──► deploy services
```

Do not put production secrets in GitHub Actions for this setup; keep them in Railway variables.

---

## 16. Branch and environment strategy

| Environment | Trigger | Database |
|---|---|---|
| Local | `task *:dev` + Docker Postgres | Local |
| Staging | Auto-deploy `main` | Railway Postgres (staging env) |
| Production | Auto-deploy `release` **or** manual promote | Railway Postgres (production env) |

| Branch | Role |
|---|---|
| Feature branches | PRs only; CI; no Railway deploy |
| `main` | Staging; Railway auto-deploy |
| `release` (or tags) | Production; Railway auto-deploy or promote |

Duplicate the same services per Railway environment with different variables and domains.

**Promote flow (simple):**

1. Merge features → `main` → staging deploys  
2. When staging is verified, merge/cherry-pick → `release` → production deploys  

**Promote flow (dashboard):** keep production on manual deploy / promote from a successful staging deployment if your Railway plan supports it.

---

## 17. Custom domains

Under each service **Settings → Networking**:

- Frontend → `app.example.com`
- API → `api.example.com`
- AI → `ai.example.com` (WSS on same host)

Then update `FRONTEND_URL`, `API_PUBLIC_URL`, frontend runtime URL vars, AI CORS vars, and OAuth provider consoles.

---

## 18. Secrets and operational hygiene

- Generate strong unique values for JWT and encryption keys; rotating JWT invalidates sessions; rotating encryption keys can break stored credentials unless you re-encrypt.
- Never commit `.env.local` or Railway variable exports with secrets.
- Prefer Railway’s shared variables / sealed secrets UI over pasting into chat or tickets.
- Provider API keys live only on the services that need them (e.g. OpenAI on AI only).
- SSO client secrets live on the API (and MCP if it loads the same settings).
- Keep reload flags false in production images.
- Limit who can edit Railway production variables; treat them like vault access.

---

## 19. Local parity (Docker build/run)

Validate images before pushing:

```bash
# From repo root — requires Docker
task docker:api:build
task docker:api:run          # uses backend/.env.local by default

task docker:frontend:build VITE_API_URL=http://localhost:8080
task docker:frontend:run
```

Or raw Docker with the **same context** Railway uses (Root Directory = context path):

```bash
docker build -t myapp-api backend/api_service
docker run --env-file backend/.env.local -p 8080:8080 -e PORT=8080 myapp-api

docker build -t myapp-frontend frontend
docker build -t myapp-ai backend/ai_service
```

If local Docker behaves differently from Railway, compare: **Root Directory**, Dockerfile path, `PORT`, and which env vars are present at **build** vs **runtime**.

---

## 20. Verification checklist

After first deploy (or any infra change):

- [ ] GitHub Actions CI is green on a sample PR (path filters behave as expected)  
- [ ] Branch protection requires the CI success check  
- [ ] Railway is connected to the correct repo and branch per environment  
- [ ] Each service Root Directory is exact: `frontend`, `backend/api_service`, `backend/ai_service`, `backend/mcp_service` (not `backend`)  
- [ ] Dockerfile path is `Dockerfile` relative to that Root Directory; watch paths match  
- [ ] `GET https://<api>/health` → healthy  
- [ ] Frontend loads over HTTPS; no mixed-content warnings  
- [ ] View Source: runtime config has non-empty API base URL  
- [ ] Register/login (or core auth) works (CORS + JWT)  
- [ ] If AI enabled: `GET https://<ai>/health` shows expected MCP URL and CORS  
- [ ] If AI enabled: WebSocket connects (`wss://…`)  
- [ ] If MCP enabled: `/sse` reachable from AI (check AI logs on first tool call)  
- [ ] API deploy logs show schema deploy completed without errors  
- [ ] OAuth callbacks (if used) match `API_PUBLIC_URL`  
- [ ] `FRONTEND_URL` exactly matches the browser origin  

---

## 21. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| App loads but API calls fail | Wrong/missing runtime API URL or CORS | Fix runtime config; align `FRONTEND_URL` |
| Runtime config still `{}` | Entrypoint inject failed or var unset | Check frontend deploy logs; set runtime URL vars |
| WebSocket fails | `ws://` instead of `wss://`; wrong path; CORS | Use `wss://`; set AI frontend CORS origin |
| AI healthy but tools fail | Bad MCP URL | Must end with `/sse`; check MCP logs |
| DB connection errors | Postgres not linked; bad URL | Re-link addon; confirm `DATABASE_URL` |
| Schema missing columns | Old container; migrate failed | Read boot logs; redeploy API |
| OAuth redirect mismatch | `API_PUBLIC_URL` ≠ public API | Update Railway var + IdP console |
| Build fails copying files / missing `pyproject.toml` | Wrong Root Directory | Set API root to `backend/api_service` (not `backend`); see §4 |
| Wrong service image / frontend Dockerfile used for API | Root Directory empty or set to repo root | Set per-service Root Directory from §4.2 |
| Service listens but Railway unhealthy | Bound to `127.0.0.1` or ignored `$PORT` | Bind `0.0.0.0` and `${PORT}` |
| MCP auth errors | JWT secret mismatch | API and MCP must share secrets |
| Actions required check stuck “skipped” | Path filter skipped a required job | Add aggregator `ci-success` job (§14.5) |
| Railway deploys broken `main` | Merges without required checks | Enforce branch protection |
| Someone added `RAILWAY_TOKEN` to Actions | Drift from playbook | Prefer GitHub↔Railway connection; remove unused token |

---

## 22. Adapting this playbook to your app

Minimal recipe:

1. **Split deployables** — one Dockerfile per process you want to scale alone.  
2. **Set Root Directory per service** — `frontend`, `backend/api_service`, `backend/ai_service`, `backend/mcp_service`. Never use `backend/` as the root for those services. Put shared code inside the service folder.  
3. **Honor `PORT` and `DATABASE_URL`** in settings with local fallbacks.  
4. **Migrate safely on boot** — never non-idempotent destructive SQL in prod CMD.  
5. **Put a `/health` (or equivalent) on every HTTP service.**  
6. **SPA config** — runtime injection for API/WebSocket URLs; don’t rely only on build-time `VITE_*`.  
7. **CORS from env** — single `FRONTEND_URL` (or list) per backend.  
8. **CI ≠ CD** — `.github/workflows/ci.yml` on PRs; Railway deploys from `main` / `release`.  
9. **Document env templates** — `.env.example` per service matching Railway variable names.  
10. **Task/Make targets** for `docker:*:build` using the **same context directories** as Railway Root Directory.  
11. **Branch protection** — required CI check (with skip-aware aggregator if using path filters).  
12. **Wire order** — Postgres → API → Frontend → optional MCP/AI → tighten URLs/CORS.

---

## 23. Reference checklist (files to create)

| Path | Purpose | Railway Root Directory |
|---|---|---|
| `backend/api_service/Dockerfile` | API image + migrate-on-boot CMD | `backend/api_service` |
| `backend/mcp_service/Dockerfile` | Optional MCP SSE image | `backend/mcp_service` |
| `backend/ai_service/Dockerfile` | Optional AI WebSocket image | `backend/ai_service` |
| `frontend/Dockerfile` | Multi-stage SPA build + runtime entrypoint | `frontend` |
| `frontend/scripts/docker-entrypoint.sh` | Inject config then static serve | `frontend` |
| `frontend/scripts/inject-runtime-config.ts` | Rewrites runtime config placeholder | `frontend` |
| `frontend/src/config.ts` | Runtime vs build-time URL resolution | `frontend` |
| `backend/api_service/settings.py` (etc.) | `PORT`, `DATABASE_URL`, CORS-related settings | matching service root |
| `backend/api_service/scripts/deploy_tables.py` | Idempotent schema + additive migrations | `backend/api_service` |
| `backend/.env.example` | Backend env template (matches Railway) | — |
| `frontend/.env.example` | Frontend Railway variable notes | — |
| `Taskfile.yml` (or Makefile) | `docker:*` and `db:deploy` targets | — |
| `.github/workflows/ci.yml` | PR CI only (path-filtered) | — |
| `README.md` | Short Railway setup checklist linking here | — |

Optional:

| Path | Purpose |
|---|---|
| `backend/api_service/railway.toml` / `frontend/railway.toml` / … | Only if you choose file-based Railway config (one per Root Directory) |
| `.github/workflows/ci.yml` → `ci-success` job | Required-check aggregator when jobs can skip |
| Docker smoke job in CI | Catch context/`COPY` errors before merge — build with the same Root Directory paths |

---

## Summary

Deploy infrastructure to Railway as a **multi-service Docker monorepo**:

1. One Railway service per containerized process; **Root Directory** set explicitly (`frontend`, `backend/api_service`, `backend/ai_service`, `backend/mcp_service`); Dockerfile builds from that folder.  
2. Platform-injected `PORT` / `DATABASE_URL`, idempotent schema on API boot, runtime-injected frontend URLs, careful CORS.  
3. **GitHub Actions for CI only** — path-filtered lint/test on PRs, branch protection, no deploy secrets.  
4. **Railway for CD** — GitHub repo connected, auto-deploy from `main` (staging) and `release` (production).  

Copy the service split, **Root Directory** mapping, Dockerfile/`PORT`/`DATABASE_URL` patterns, frontend runtime config approach, and the CI/CD separation to get the same operational shape on another app.

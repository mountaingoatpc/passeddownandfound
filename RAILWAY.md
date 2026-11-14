# Railway Infrastructure Playbook

A generic, copyable pattern for deploying a multi-service app on [Railway](https://railway.com). Distilled from how this repo actually ships: an isolated monorepo, one Dockerfile per service, GitHub auto-deploy, two persistent Railway environments, and a Postgres addon.

Nothing here is domain-specific. Replace `myapp` with your app name and keep the same bones.

Railway is the only production runtime. There is no Terraform, Kubernetes, or GitHub Actions deploy job. Git push is the deploy.

---

## 1. Mental model

Railway is nested like this:

```
Workspace
└── Project: myapp
    ├── Environment: dev          ← isolated copies of every service + DB
    └── Environment: prod
        ├── Service: frontend     ← GitHub repo + Dockerfile
        ├── Service: api          ← GitHub repo + Dockerfile
        ├── Service: ai           ← GitHub repo + Dockerfile (optional)
        └── Service: Postgres     ← Railway plugin, not your repo
```

**Project** = one app. All services that should share private networking and variable references live in the same project.

**Environment** = a full isolated copy of that project (services, variables, volumes, domains, database). Changes in `dev` never affect `prod`. Duplicate an environment rather than recreating services by hand.

**Service** = one process with its own image, variables, domain, and healthcheck. Prefer one service per Dockerfile. Do not run two HTTP servers in one container.

Local development is **not** a Railway environment. Run Postgres in Docker on your laptop and point `.env.local` at it.

---

## 2. What you are implementing

| Decision | This pattern |
|---|---|
| Platform | Railway, Dockerfiles only (no Nixpacks) |
| Repo shape | Isolated monorepo: each service is self-contained under its own directory |
| Environments | `dev` auto-deploys from `main`; `prod` auto-deploys from `release` |
| Database | Railway Postgres plugin per environment; app reads `DATABASE_URL` |
| Config | Service variables in the Railway dashboard; secrets never committed |
| Frontend → API | Browser calls the API's **public** HTTPS URL |
| Service → service | Private network (`*.railway.internal`) |
| Schema changes | Idempotent migrate-on-boot in the API container |
| Disk | Container FS is ephemeral; attach a volume for anything that must survive a deploy |

---

## 3. Repository layout Railway expects

This is an **isolated monorepo**: frontend and each backend service do not share a Docker build context. Railway's Root Directory for a service is the folder that contains that service's `Dockerfile`.

```
myapp/
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
├── backend/
│   ├── .env.example              # committed template
│   ├── api_service/
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   ├── pyproject.toml        # service-local deps for Docker
│   │   ├── api.py
│   │   ├── settings.py
│   │   ├── scripts/deploy_tables.py
│   │   └── lib/
│   └── ai_service/
│       ├── Dockerfile
│       ├── pyproject.toml
│       └── app.py
├── Taskfile.yml
└── RAILWAY.md
```

Rules that make this work:

1. **Each deployable unit has its own Dockerfile and its own dependency manifest** (`pyproject.toml` / `package.json`). The image cannot `COPY` files from outside Railway's Root Directory.
2. **Root Directory in Railway = the Dockerfile's build context.** For the API that is `backend/api_service`, not `backend/`.
3. **Watch paths** (gitignore-style) stop a frontend-only commit from rebuilding the API. Root Directory is the build context; watch paths are the deploy trigger.
4. Optional `railway.toml` lives in the service directory. If you set Root Directory, the config-as-code path is still the **repo-absolute** path (e.g. `/backend/api_service/railway.toml`), because Railway does not join it to Root Directory.

Python gotcha: if the process is `uvicorn api_service.api:app`, the image must contain a package directory named `api_service`. The Dockerfile copies the Root Directory *into* that package name (see §5).

---

## 4. Git → Railway mapping

Connect the GitHub repo once per service. Then pin a branch **per environment**.

| Git branch | Railway environment | What happens |
|---|---|---|
| `main` | `dev` | Push → Railway rebuilds every service whose watch paths matched |
| `release` | `prod` | Push → same, against prod services and the prod database |
| Feature branches / PRs | (optional) PR environments | Temporary copies; enable in Project Settings → Environments |

Promotion to production is a git operation, not a Railway "promote" button:

```bash
git checkout release
git merge main --no-edit
git push origin release    # this is the prod deploy
```

There is no deploy pipeline in GitHub Actions. CI (lint/test) can stay in GitHub Actions or a Taskfile; Railway only builds what you push to the connected branch.

Never force-push `main` or `release`. Railway deploys whatever that branch tip is.

---

## 5. Dockerfiles (the deploy contract)

Railway looks for a file named `Dockerfile` (capital D) at the Root Directory. If it finds one, the build log shows `Using detected Dockerfile!`.

Every web process must listen on `0.0.0.0` and **`${PORT}`**. Railway injects `PORT` and healthchecks that port. Local fallbacks (`8091`, `8001`, `3000`) exist only so the same Dockerfile runs on a laptop.

### API service

Build context = `backend/api_service`.

```dockerfile
# Build context: backend/api_service (Railway Root Directory = backend/api_service)
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml ./
RUN uv pip install --system --no-cache -r pyproject.toml

COPY lib/ ./lib/
COPY scripts/ ./scripts/
COPY . ./api_service/

ENV PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import os; import urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/health')"

CMD ["sh", "-c", "python scripts/deploy_tables.py && uvicorn api_service.api:app --host 0.0.0.0 --port ${PORT:-8091}"]
```

Why this shape:

- `COPY --from=ghcr.io/astral-sh/uv` puts `uv` in a slim image without a separate install layer.
- `COPY . ./api_service/` makes `uvicorn api_service.api:app` resolve.
- Schema deploy runs **before** the server binds. `deploy_tables.py` must be idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). A failing migration fails the deploy instead of serving a broken schema.
- Docker `HEALTHCHECK` is for the container runtime. Railway's **service healthcheck path** (dashboard or `railway.toml`) is what actually gates zero-downtime cutover. Set both to `/health`.

### AI (or any second Python) service

Same idea, no migrate-on-boot.

```dockerfile
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
COPY pyproject.toml ./
RUN uv pip install --system --no-cache -r pyproject.toml

COPY . ./ai_service/

ENV PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import os; import urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/health')"

CMD ["sh", "-c", "uvicorn ai_service.app:app --host 0.0.0.0 --port ${PORT:-8001}"]
```

Locally the API and AI cannot both bind Railway's `PORT`. Use `PORT` for the API and `AI_SERVICE_PORT` (or similar) for local AI. **On Railway, every service binds `PORT`.** The Dockerfile above is correct; do not make the AI container listen on `AI_SERVICE_PORT` in production.

### Frontend (Vite SPA)

Multi-stage: build with Bun, serve static files. Vite inlines `import.meta.env.VITE_*` at **build** time, so any URL the browser needs must be declared as `ARG`/`ENV` in the builder stage.

```dockerfile
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN bun run build

FROM oven/bun:1-slim AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
RUN bun add serve

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD bun -e "fetch('http://localhost:' + (process.env.PORT || '3000')).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "bun -e \"const url=process.env.VITE_API_URL||process.env.API_URL||'/api';require('fs').writeFileSync('dist/config.js','window.__RUNTIME_CONFIG__='+JSON.stringify({apiBaseUrl:url}))\" && bunx serve dist -s -l tcp://0.0.0.0:${PORT:-3000}"]
```

Two layers of API URL, on purpose:

1. **Build-time.** Railway injects service variables into Docker as build-args when the Dockerfile declares a matching `ARG`. `VITE_API_URL` is baked into the Vite bundle.
2. **Start-time.** The CMD writes `dist/config.js` as `window.__RUNTIME_CONFIG__`. The SPA reads that first, then the Vite env, then `"/api"`.

The HTML must load `/config.js` before the app module. In local Vite, a tiny plugin can serve the same file with `apiBaseUrl: "/api"` and proxy `/api` to the local backend.

`.dockerignore` the Dockerfile itself and caches (`__pycache__`, `node_modules`) so they are not copied into the image.

---

## 6. Railway dashboard: create the project once

Do this in the Railway UI (or CLI). It is not in git unless you add `railway.toml`.

### Project and environments

1. New project `myapp`. Railway creates a `production` environment; rename or add so you have **`dev` and `prod`**.
2. Duplicate `dev` → `prod` after `dev` works, then re-point prod's Git branches and replace variables that must not be shared (JWT secret, public URLs, database).
3. Settings → Environments: optionally enable PR environments. For monorepos, enable **Focused PR Environments** so only services whose watch paths match (plus their variable-reference dependencies) deploy.

### Per service (repeat for frontend, api, ai)

| Setting | Value |
|---|---|
| Source | GitHub `org/myapp` |
| Branch (`dev` env) | `main` |
| Branch (`prod` env) | `release` |
| Root Directory | `frontend` / `backend/api_service` / `backend/ai_service` |
| Builder | Dockerfile (auto-detected) |
| Watch paths | `/frontend/**` or `/backend/api_service/**` or `/backend/ai_service/**` |
| Healthcheck path | `/health` |
| Restart policy | On failure, ~10 retries |
| Public domain | Generate a `*.up.railway.app` domain for anything the browser hits |
| Custom domain | Later, under Settings → Networking |

Postgres is **not** connected to GitHub. Add it with **+ New → Database → PostgreSQL** in each environment (or once, then duplicate the environment).

### Optional `railway.toml`

If you want config in git, put this next to each Dockerfile. Railway still needs Root Directory / branch / variables in the dashboard.

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

---

## 7. Variables

Never commit `.env.local`, `.env.dev`, or `.env.prod`. Commit `.env.example` with empty secrets.

Railway has three kinds of values:

1. **Injected by Railway** — `PORT`, `RAILWAY_ENVIRONMENT`, `RAILWAY_PUBLIC_DOMAIN`, `RAILWAY_PRIVATE_DOMAIN`, and (for Postgres) `DATABASE_URL`.
2. **Reference variables** — `${{Postgres.DATABASE_URL}}`, `${{api.RAILWAY_PRIVATE_DOMAIN}}`. Resolved per environment. Prefer these over copy-pasted URLs.
3. **You set** — secrets and app config. Seal secrets (`JWT_SECRET`, API keys) so they cannot be read back.

Changing a variable redeploys the service unless you skip deploys.

### API service

| Name | Source | Notes |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Private URL. Do **not** use `DATABASE_PUBLIC_URL` (public TCP proxy, billed as egress). |
| `PORT` | Railway | Bind uvicorn to this. |
| `JWT_SECRET` | You, sealed | Different value in prod vs dev. |
| `FRONTEND_URL` | `${{frontend.RAILWAY_PUBLIC_DOMAIN}}` as `https://...` | CORS allowlist. |
| `AI_SERVICE_URL` | `http://${{ai.RAILWAY_PRIVATE_DOMAIN}}:${{ai.PORT}}` | Server-side only. Not the public `*.up.railway.app` URL. |

App settings should treat `DATABASE_URL` as canonical and fall back to `DB_HOST` / `DB_PORT` / … for local Docker Postgres:

```python
def normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if "sslmode=" not in url and ("railway" in url or "rlwy.net" in url):
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}sslmode=require"
    return url
```

Railway/Heroku-style URLs often come as `postgres://`. psycopg wants `postgresql://`. Private Railway URLs need `sslmode=require` if it is not already on the query string.

`PORT` is not a Pydantic field you set — read `os.environ.get("PORT")` with a local default.

### AI service

| Name | Source |
|---|---|
| `PORT` | Railway (bind uvicorn here) |
| `AI_SERVICE_OPENAI_API_KEY` | You, sealed |
| `AI_SERVICE_MODEL` / similar | You |

`AI_SERVICE_PORT` is a **local-only** name so two processes can run on a laptop. Do not make production listen on it.

### Frontend

| Name | When it is used |
|---|---|
| `VITE_API_URL` | Build-time `ARG` **and** runtime `config.js`. Must be the API's **public** HTTPS origin, e.g. `https://myapp-api-prod.up.railway.app`. No trailing path unless your API is mounted on one. |
| `PORT` | Railway; `bunx serve` listens here. |

The browser cannot use `*.railway.internal`. If the SPA talks to the API, `VITE_API_URL` is always public.

If the built frontend returns HTML for API calls, `VITE_API_URL` is missing or wrong and the browser is hitting the static server.

### Shared variables

Use environment-level shared variables for values many services need (`${{shared.SENTRY_DSN}}`). Keep database URLs and per-service secrets on the service that uses them.

---

## 8. Networking

```
Browser
  │  HTTPS  (public domain)
  ▼
frontend ──────────────► api          public HTTPS (VITE_API_URL)
                           │
                           │  HTTP     private DNS
                           ▼
                          ai
                           │
api / ai ─────────────────► Postgres   DATABASE_URL (private)
```

**Public.** Generate a Railway domain on frontend and api (and ai only if a browser or webhook must reach it). Custom domains are CNAME/ALPN on Settings → Networking.

**Private.** Same project + same environment only. Hostname is `{service-name}.railway.internal`. Example: API calls AI at `http://ai.railway.internal:${{ai.PORT}}`.

CORS on the API:

- Explicit origins: `FRONTEND_URL`, plus `http://localhost:5173` / `http://localhost:3000` for local.
- Regex for default Railway domains: `https://.*\.up\.railway\.app`.
- Custom domains must be listed in `FRONTEND_URL` (or an extra allowlist var). The regex will not match them.
- If you restrict hosts, allow `healthcheck.railway.app` — that is where Railway's deploy healthcheck originates.

---

## 9. Postgres

- One plugin **per environment**. `dev` and `prod` must not share a database.
- Linking / referencing `${{Postgres.DATABASE_URL}}` is enough; you do not pass host/user/password separately on Railway.
- Connection pool in the app (`psycopg_pool`), modest size (e.g. 2–10). Railway Postgres connection limits are real.
- Warm the pool at API startup so the first request is not a cold connect.
- Public TCP proxy (`DATABASE_PUBLIC_URL`) is for laptop `psql` / one-off `task db:deploy ENV=prod` only. Prefer `railway connect` or a local `.env.prod` you never commit.

Idempotent schema deploy:

```python
# CREATE EXTENSION / CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
# then commit. Safe to run on every API boot and from:
#   task db:deploy ENV=prod
```

Do **not** run destructive `--reset` against Railway. After a release that only needed additive SQL, migrate-on-boot is enough; a laptop `db:deploy` against prod is a fallback if you need to apply schema without waiting for a new API deploy.

---

## 10. Persistent disk

The container filesystem is wiped on every deploy/restart. Uploads, SQLite, or any user files written under the app directory will vanish.

Options:

1. **Volume** on the API service, mount e.g. `/app/uploads`, set `UPLOADS_DIR=/app/uploads`. Volumes skip zero-downtime: Railway will not run two replicas mounted on the same volume, so there is a brief cutover even with a healthcheck.
2. **Object storage** (S3 / Railway bucket) if you need multiple replicas or to keep the API stateless.

If you attach a volume, do not horizontally scale that service until the files move off local disk.

---

## 11. Healthchecks and what a deploy looks like

1. Push to the environment's branch (or a variable change).
2. Railway builds the Dockerfile from Root Directory.
3. New replica starts, runs CMD (API: migrate, then uvicorn).
4. Railway GETs `http://{service}:{PORT}/health` from hostname `healthcheck.railway.app` until HTTP 200 or timeout (default 300s).
5. Traffic switches to the new replica; old replica is taken down.

`/health` should be cheap and not need the database if you want deploys to succeed when Postgres is slow to accept connections. A deeper "ready" check is optional and separate.

Docker `HEALTHCHECK` does not replace the Railway healthcheck path. Set the dashboard/toml path.

---

## 12. Local development vs Railway

| | Laptop | Railway `dev` | Railway `prod` |
|---|---|---|---|
| Trigger | `task api_service:dev` etc. | Push `main` | Push `release` |
| Postgres | Docker container | Plugin in `dev` | Plugin in `prod` |
| Env file | `backend/.env.local` | Dashboard vars | Dashboard vars |
| Frontend API URL | Vite proxy `/api` → local API | Public API domain | Public API domain |
| `PORT` | Hardcoded in `.env.local` | Injected | Injected |

Task runner pattern: `dotenv: ['.env.{{.ENV | default "local"}}']` so `task db:deploy ENV=prod` loads `.env.prod` without exporting secrets in the shell.

`.env.example` documents every variable. Copy to `.env.local` for day-to-day work.

---

## 13. Bootstrap checklist (new app)

1. Repo layout from §3; one Dockerfile per service; `/health` on every HTTP process.
2. Settings read `DATABASE_URL` and `PORT`; normalize the DB URL.
3. CORS: `FRONTEND_URL` + localhost + `*.up.railway.app`.
4. Frontend: `ARG VITE_API_URL` + runtime `config.js`.
5. Create Railway project; add `dev` and `prod` environments.
6. Add Postgres to `dev`. Create empty services (or GitHub deploys) for frontend, api, ai.
7. Set Root Directory, branch `main`, watch paths, healthcheck `/health`.
8. Generate public domains on frontend and api.
9. Set variables from §7 using **references**, not pasted URLs.
10. Deploy `dev` from `main`. Confirm `/health`, then a real browser login against the public frontend.
11. Duplicate environment to `prod` (or recreate). Switch branches to `release`. Rotate `JWT_SECRET`. Confirm Postgres is a **new** instance. Set prod public URLs on `VITE_API_URL` / `FRONTEND_URL`.
12. Protect `release` on GitHub; only merge from `main`.

---

## 14. Common failures

| Symptom | Likely cause |
|---|---|
| Deploy healthcheck "service unavailable" | Process not listening on `PORT`, or healthcheck path unset |
| Frontend shows HTML instead of JSON | `VITE_API_URL` not set; browser is calling the SPA origin |
| CORS error in the browser | `FRONTEND_URL` is not the exact frontend origin; custom domain not allowlisted |
| `postgres://` / SSL errors | Missing URL normalize; using public URL without `sslmode` |
| API cannot reach AI | Using the public AI URL, wrong port, or services in different environments |
| Uploads disappear after deploy | No volume / object storage |
| Every service rebuilds on any commit | Watch paths not set |
| Build cannot see `../lib` | Root Directory is the service folder; copy shared code into that folder or use a shared monorepo build |
| AI works locally, binds the wrong port on Railway | Listening on `AI_SERVICE_PORT` instead of `PORT` |
| Vite env empty in production | Missing `ARG`/`ENV` in the **builder** stage (runtime `ENV` does not reach `bun run build`) |

---

## 15. Tooling

- **Dashboard** — domains, variables, logs, rollback.
- **CLI** — `railway link`, `railway logs`, `railway variables`, `railway up` for an emergency one-off from the laptop.
- **MCP** (`@railway/mcp-server`) — list services, logs, variables, docs. Useful in Cursor; same auth as the CLI.

Rollback: redeploy a previous successful deployment from the dashboard rather than force-pushing git unless you intend to change the branch history.

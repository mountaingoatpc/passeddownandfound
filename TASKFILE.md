# Taskfile Guide

A reusable pattern for a monorepo task runner using [Task](https://taskfile.dev). Drop a `Taskfile.yml` at the repo root and expose every common workflow as a named, documented command.

Replace placeholders like `myapp`, service module paths, and container names with your project’s equivalents.

---

## Why Task

- **Readable YAML** instead of Make’s brittle syntax
- **Built-in `dotenv`** so env-aware tasks load `.env.{ENV}` without shell glue
- **`dir:`** runs each task in the right package; no `cd` in commands
- **Namespaced names** (`backend:lint`, `db:deploy`) stay discoverable via `task --list`
- **Composition** — top-level tasks call other tasks (`install` → `backend:install` + `frontend:install`)
- **Guards** — `requires`, `preconditions`, `status`, and `prompt` for safe / interactive flows

Install Task, then from the repo root:

```bash
task --list          # all public tasks + descriptions
task <name>          # run a task
task <name> ENV=prod # override the default env file suffix
```

---

## Design Principles

| Principle | How it shows up |
|-----------|-----------------|
| Namespace by concern | `backend:*`, `frontend:*`, `db:*`, `test:*`, `release:*`, plus per-service `*:dev` |
| Default to local env | `dotenv: ['.env.{{.ENV \| default "local"}}']` under `backend/` (or wherever env files live) |
| Set working directory | `dir: backend` / `dir: frontend` on package-scoped tasks |
| Describe every public task | `desc:` is what `task --list` shows — include usage hints for vars |
| Keep internals private | `internal: true` for steps only meant to be called by other tasks |
| Idempotent where possible | e.g. `db:create` uses `status:` so re-runs are no-ops if the container exists |
| Destructive = explicit | Reset / drop tasks say so in `desc` and take an `ENV=` so you never hit prod by accident |

---

## Environment convention

Env-aware tasks load:

```text
backend/.env.{{.ENV | default "local"}}
```

Typical files:

| File | Purpose |
|------|---------|
| `.env.local` | Local Docker Postgres / local services |
| `.env.dev` | Shared or remote dev |
| `.env.prod` | Production (use carefully; prefer platform secrets for real deploys) |

Pass `ENV=` only when you need a non-local file:

```bash
task db:deploy ENV=prod
task api_service:dev ENV=dev
```

---

## Task catalog

### Install

| Task | Purpose |
|------|---------|
| `install` | Install backend + frontend deps (calls the two tasks below) |
| `backend:install` | Sync Python deps (e.g. `uv sync --extra dev`) |
| `frontend:install` | Install JS deps (e.g. `bun install`) |

### Backend quality

| Task | Purpose |
|------|---------|
| `backend:lint` | Lint only |
| `backend:format` | Format |
| `backend:check` | Lint + format check (CI-friendly) |

### Services (dev servers)

Name tasks after the runnable service, not the whole backend package:

| Task | Purpose |
|------|---------|
| `api_service:dev` | Run the HTTP API locally |
| `ai_service:dev` | Run an optional AI / agent service |
| *(optional)* `mcp_service:dev` | MCP or other sidecar processes |

Each typically: `dir: backend`, load dotenv, then `uv run python -m <module>`.

### Frontend

| Task | Purpose |
|------|---------|
| `frontend:install` | Install dependencies |
| `frontend:dev` | Dev server |
| `frontend:build` | Production build |
| `frontend:check` | Lint / format check (e.g. Biome) |

### Aggregate lint

| Task | Purpose |
|------|---------|
| `lint` | Run `backend:check` then `frontend:check` |

Use this from CI and from release preflight so “green locally” matches “green in release”.

### Database

Assumes a local Postgres container for day-to-day work and schema scripts for deploy/reset.

| Task | Purpose |
|------|---------|
| `db:create` | Start a named Postgres Docker container (idempotent via `status:`) |
| `db:start` / `db:stop` | Start or stop that container |
| `db:deploy` | Create / migrate tables (idempotent). `ENV=` selects which DB |
| `db:reset` | Drop and recreate tables (**destructive**). `ENV=` required awareness |
| `db:psql` | Interactive `psql` using dotenv credentials (`interactive: true`) |

Use a stable container name and DB name derived from the app (e.g. `myapp-db` / `myapp`). Point `.env.local` at `localhost` and those credentials.

### Tests

| Task | Purpose |
|------|---------|
| `test:backend` | Run backend test suite with dotenv loaded |

Add `test:frontend` the same way if the frontend has a test script.

### Release (optional but recommended)

Pattern: one public orchestrator, one “tag only” shortcut, and private stepped tasks with prompts.

| Task | Visibility | Purpose |
|------|------------|---------|
| `release-full` | public | Full interactive prod release; requires `VERSION=` |
| `release` | public | Create GitHub Release only (branch already pushed); requires `VERSION=` |
| `release:preflight` | internal | Clean tree, on `main`, `gh` present, `git fetch` |
| `release:lint` | internal | Prompt → `task lint` |
| `release:test` | internal | Prompt → `task test:backend` |
| `release:merge` | internal | Prompt → merge `main` into `release` |
| `release:push` | internal | Prompt → push `release` (triggers prod deploy) |
| `release:gh-release` | internal | Prompt → `gh release create` |
| `release:finish` | internal | Checkout `main`; print post-release reminders (e.g. `db:deploy ENV=prod`) |

Assumptions you can adapt:

- `main` → non-prod deploy; `release` → prod deploy
- Version tags look like `v1.2.0`
- GitHub CLI (`gh`) is available

**Note for agents / CI:** interactive `prompt:` needs a TTY. For scripted or agent-driven releases, run the same steps manually and confirm each gate with a human instead of calling `release-full`.

---

## Complete template

Copy into `Taskfile.yml` and adjust names, module paths, and package managers.

```yaml
version: "3"

tasks:
  install:
    desc: Install all dependencies (backend + frontend)
    cmds:
      - task: backend:install
      - task: frontend:install

  backend:install:
    desc: Install backend dependencies with uv
    dir: backend
    cmds:
      - uv sync --extra dev

  backend:lint:
    desc: Run ruff linter
    dir: backend
    cmds:
      - uv run ruff check .

  backend:format:
    desc: Format backend code with ruff
    dir: backend
    cmds:
      - uv run ruff format .

  backend:check:
    desc: Run both lint and format check
    dir: backend
    cmds:
      - uv run ruff check .
      - uv run ruff format --check .

  api_service:dev:
    desc: "Run API server locally. Usage: task api_service:dev [ENV=local]"
    dir: backend
    dotenv:
      - '.env.{{.ENV | default "local"}}'
    cmds:
      - uv run python -m api_service.api

  ai_service:dev:
    desc: "Run AI service locally. Usage: task ai_service:dev [ENV=local]"
    dir: backend
    dotenv:
      - '.env.{{.ENV | default "local"}}'
    cmds:
      - uv run python -m ai_service.app

  frontend:install:
    desc: Install frontend dependencies with bun
    dir: frontend
    cmds:
      - bun install

  frontend:dev:
    desc: Run frontend dev server
    dir: frontend
    cmds:
      - bun run dev

  frontend:build:
    desc: Build frontend for production
    dir: frontend
    cmds:
      - bun run build

  frontend:check:
    desc: Run Biome check
    dir: frontend
    cmds:
      - bun run check

  lint:
    desc: Run all linters (backend + frontend)
    cmds:
      - task: backend:check
      - task: frontend:check

  db:create:
    desc: Start a local PostgreSQL container (Docker)
    cmds:
      - docker run -d --name myapp-db -e POSTGRES_DB=myapp -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
      - echo "Waiting for Postgres to be ready..."
      - sleep 3
    status:
      - docker ps --filter name=myapp-db -q | grep -q .

  db:start:
    desc: Start the local PostgreSQL container (if stopped)
    cmds:
      - docker start myapp-db

  db:stop:
    desc: Stop the local PostgreSQL container
    cmds:
      - docker stop myapp-db

  db:deploy:
    desc: "Create database tables (idempotent). Usage: task db:deploy [ENV=local]"
    dir: backend
    dotenv:
      - '.env.{{.ENV | default "local"}}'
    cmds:
      - uv run python api_service/scripts/deploy_tables.py

  db:reset:
    desc: "Drop and recreate all tables (DESTRUCTIVE). Usage: task db:reset [ENV=local]"
    dir: backend
    dotenv:
      - '.env.{{.ENV | default "local"}}'
    cmds:
      - uv run python api_service/scripts/deploy_tables.py --reset

  db:psql:
    desc: "Open psql shell. Usage: task db:psql [ENV=local]"
    dir: backend
    interactive: true
    dotenv:
      - '.env.{{.ENV | default "local"}}'
    cmds:
      - PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}"

  test:backend:
    desc: "Run backend tests. Usage: task test:backend [ENV=local]"
    dir: backend
    dotenv:
      - '.env.{{.ENV | default "local"}}'
    cmds:
      - uv run pytest tests/ -v

  # ─────────────────────────────────────────────
  # Release
  # ─────────────────────────────────────────────
  release-full:
    desc: "Full interactive prod release. Usage: task release-full VERSION=v1.0.0"
    requires:
      vars: [VERSION]
    cmds:
      - task: release:preflight
      - task: release:lint
      - task: release:test
      - task: release:merge
      - task: release:push
      - task: release:gh-release
        vars:
          VERSION: "{{.VERSION}}"
      - task: release:finish
        vars:
          VERSION: "{{.VERSION}}"

  release:
    desc: "Create GitHub Release only (release branch already pushed). Usage: task release VERSION=v1.0.0"
    requires:
      vars: [VERSION]
    cmds:
      - task: release:gh-release
        vars:
          VERSION: "{{.VERSION}}"

  release:preflight:
    desc: Verify release prerequisites
    internal: true
    preconditions:
      - sh: test -z "$(git status --porcelain)"
        msg: "Working tree must be clean (commit or stash changes first)"
      - sh: test "$(git branch --show-current)" = "main"
        msg: "Must be on main branch"
      - sh: command -v gh >/dev/null 2>&1
        msg: "GitHub CLI (gh) is required — install from https://cli.github.com"
    cmds:
      - git fetch origin

  release:lint:
    desc: "Release step 1/6 — lint"
    internal: true
    prompt: "Run lint (backend + frontend)?"
    cmds:
      - task: lint

  release:test:
    desc: "Release step 2/6 — backend tests"
    internal: true
    prompt: "Run backend tests?"
    cmds:
      - task: test:backend

  release:merge:
    desc: "Release step 3/6 — merge main into release"
    internal: true
    prompt: "Merge main into release branch?"
    cmds:
      - git checkout release
      - git merge main --no-edit

  release:push:
    desc: "Release step 4/6 — push release (triggers prod deploy)"
    internal: true
    prompt: "Push release branch to origin (triggers prod deploy)?"
    cmds:
      - git push origin release

  release:gh-release:
    desc: "Release step 5/6 — create GitHub Release"
    internal: true
    requires:
      vars: [VERSION]
    prompt: "Create GitHub Release {{.VERSION}}?"
    cmds:
      - gh release create {{.VERSION}} --target release --generate-notes --latest

  release:finish:
    desc: "Release step 6/6 — return to main"
    internal: true
    requires:
      vars: [VERSION]
    cmds:
      - git checkout main
      - |
        echo ""
        echo "Release complete."
        echo "If this release included schema changes, run: task db:deploy ENV=prod"
        echo "Verify prod deploy and: gh release view {{.VERSION}}"
```

---

## Quick reference

```bash
# First-time setup
task install
task db:create
task db:deploy

# Day-to-day (separate terminals)
task api_service:dev
task frontend:dev
# task ai_service:dev   # if you have one

# Quality
task lint
task test:backend

# Database
task db:deploy
task db:reset              # destructive
task db:psql
task db:deploy ENV=prod    # after a schema-changing release

# Release
task release-full VERSION=v1.2.0
task release VERSION=v1.2.0   # tag only
```

---

## Adapting to another app

1. **Install Task** and add `Taskfile.yml` at the repo root.
2. **Match package managers** — swap `uv` / `bun` / `ruff` / Biome for whatever the stack uses; keep the same task *names* if you can so muscle memory transfers.
3. **Rename containers and DBs** — `myapp-db` / `POSTGRES_DB=myapp` must match `.env.local`.
4. **Point service tasks at real modules** — `python -m api_service.api` → your entrypoints.
5. **Align schema scripts** — `db:deploy` / `db:reset` should call your migrate / create-tables script.
6. **Wire release to your branches** — change `main` / `release` and deploy prompts if your branching model differs.
7. **Optional extras** — Docker build/run tasks, MCP inspect, `db:query`, frontend tests: add under the same namespaces.
8. **Tell agents to prefer Task** — a Cursor rule like “always run `task <name>` instead of raw package-manager commands” keeps docs and automation consistent.

---

## Related habits

- Commit `.env.example`; ignore `.env` / `.env.*` (except the example).
- Keep `desc:` up to date — it is the public API of the repo’s CLI.
- Prefer adding a Taskfile entry over documenting a one-off shell recipe in the README.

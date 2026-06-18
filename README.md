# atticory

Inventory from the attic and beyond — sign in, photograph items on mobile, and track costs and sale prices.

## Stack

- **Frontend:** React 19, TanStack Router, Tailwind CSS v4, Bun
- **Backend:** FastAPI, PostgreSQL, JWT auth
- **Deploy:** Railway (see `GENERIC_APP.md` for full architecture)

## Quick Start

```bash
# Install dependencies
task install

# Start local Postgres (first time)
task db:create

# Create tables
task db:deploy

# Run API (terminal 1) — http://localhost:8091
task api_service:dev

# Run AI service (terminal 2) — http://localhost:8001
task ai_service:dev

# Run frontend (terminal 3) — http://localhost:5173
task frontend:dev
```

Open [http://localhost:5173](http://localhost:5173). The frontend proxies API requests to [http://localhost:8091](http://localhost:8091). Register an account, then use **Inventory** to browse items and **Add Item** to photograph and catalog finds.

Set `AI_SERVICE_OPENAI_API_KEY` in `backend/.env.local` to enable **Analyze with AI** on the Add Item page.

## Releases

| Branch | Environment | Trigger |
|--------|-------------|---------|
| `main` | Dev | Push → Railway rebuilds dev services |
| `release` | Prod | Push → Railway rebuilds prod services |

```bash
# Full interactive release (lint, test, merge, push, GitHub Release)
task release-full VERSION=v1.0.0

# GitHub Release only (after release branch is already pushed)
task release VERSION=v1.0.0
```

After a release with schema changes:

```bash
task db:deploy ENV=prod
```

See [guide_to_releases.md](guide_to_releases.md) for the full workflow.

## Mobile Photo Capture

On mobile browsers, the Add Item page offers **Take Photo** (uses the device camera via `capture="environment"`) and **Gallery** to upload existing images.

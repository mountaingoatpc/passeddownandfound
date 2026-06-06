# Passed Down and Found

Inventory management for treasured finds — sign in, photograph items on mobile, and track costs and sale prices.

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

# Run frontend (terminal 2) — http://localhost:5173
task frontend:dev
```

Open [http://localhost:5173](http://localhost:5173). The frontend proxies API requests to [http://localhost:8091](http://localhost:8091). Register an account, then use **Inventory** to browse items and **Add Item** to photograph and catalog finds.

## Mobile Photo Capture

On mobile browsers, the Add Item page offers **Take Photo** (uses the device camera via `capture="environment"`) and **Gallery** to upload existing images.

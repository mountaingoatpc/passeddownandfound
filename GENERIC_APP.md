# Building a Modern Full-Stack App: Architectural Blueprint

A comprehensive guide to building a production-ready application with a React frontend, Python microservice backend, AI/MCP capabilities, PostgreSQL database, and Railway-managed infrastructure.

This document captures every architectural decision, tooling choice, and code pattern you need to stand up a new project with the same bones. Nothing here is domain-specific -- replace "myapp" with your app's name and start building.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Repository Structure](#2-repository-structure)
3. [Frontend Stack](#3-frontend-stack)
4. [Backend Stack](#4-backend-stack)
5. [Database Layer](#5-database-layer)
6. [AI and MCP Architecture](#6-ai-and-mcp-architecture)
7. [Deployment with Railway](#7-deployment-with-railway)
8. [CI/CD (GitHub Actions)](#8-cicd-github-actions)
9. [Developer Tooling](#9-developer-tooling)
10. [AGENTS.md -- AI Coding Agent Context System](#10-agentsmd----ai-coding-agent-context-system)
11. [Getting Started Checklist](#11-getting-started-checklist)

---

## 1. High-Level Architecture

The application is a monorepo with up to four independently deployable services that communicate over HTTPS and WebSocket. Each service runs in its own Docker container on Railway.

### Service Map

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│               React 19 + TanStack Router + Vite                 │
│                        (port 3000)                              │
└──────────┬──────────────────────────────────┬───────────────────┘
           │ REST (HTTPS)                     │ WebSocket (WSS)
           ▼                                  ▼
┌─────────────────────┐          ┌─────────────────────────────┐
│     API SERVICE      │          │        AI SERVICE            │
│  FastAPI (port 8080) │          │  FastAPI + WS (port 8001)   │
│  CRUD, Auth, Search  │          │  Agent orchestration,       │
│                      │◄─────────│  streaming responses        │
└──────────┬───────────┘  REST    └──────────┬──────────────────┘
           │                                  │ SSE
           │                                  ▼
           │                      ┌─────────────────────────────┐
           │                      │       MCP SERVICE            │
           │                      │  FastMCP SSE (port 8080)    │
           │                      │  Auto-generated from API    │
           │                      └──────────┬──────────────────┘
           │                                  │ REST (internal)
           │                                  ▼
           │                      ┌─────────────────────────────┐
           └─────────────────────►│       POSTGRESQL             │
                                  │  Railway Postgres Addon      │
                                  └─────────────────────────────┘
```

### How the Services Talk

| From | To | Protocol | Purpose |
|---|---|---|---|
| Frontend | API Service | REST (HTTPS) | CRUD operations, auth, search |
| Frontend | AI Service | WebSocket (WSS) | Streaming AI chat responses |
| AI Service | MCP Service | SSE | AI agent calls tools exposed by MCP |
| MCP Service | API Service | Internal (in-process) | MCP tools invoke FastAPI endpoints |
| AI Service | API Service | REST (HTTPS) | Prompt loading, conversation persistence |
| API Service | PostgreSQL | TCP (SSL) | All data storage |
| MCP Service | PostgreSQL | TCP (SSL) | Direct DB access for tools |

### Why This Shape

- **API Service** is the single source of truth for your data model. All CRUD, auth, and business logic lives here.
- **MCP Service** automatically wraps your API as MCP tools so AI agents can interact with your data without custom integration code.
- **AI Service** is decoupled from the API so you can scale AI workloads independently, swap models, or add agents without touching your core API.
- **Frontend** is a static SPA served by a lightweight Bun server. API URLs are baked in at build time via Vite environment variables.

### Starting Simple

You do not need all four services from day one. A minimal app starts with:

1. **Frontend** + **API Service** + **PostgreSQL**

Add the MCP and AI services later when you need AI capabilities. The architecture is designed to grow incrementally.

---

## 2. Repository Structure

```
myapp/
├── frontend/                  # React + TanStack frontend
│   ├── src/
│   │   ├── api/               # API client, hooks, resource modules
│   │   ├── components/        # React components
│   │   │   ├── ui/            # Reusable primitives (button, card, input, etc.)
│   │   │   ├── layout/        # Layout components (navbar, footer, sidebar)
│   │   │   └── icons/         # SVG icon components
│   │   ├── hooks/             # Custom React hooks (auth, etc.)
│   │   ├── lib/               # Utilities and helpers (cn.ts, etc.)
│   │   ├── routes/            # TanStack Router file-based routes
│   │   │   ├── __root.tsx     # Root layout
│   │   │   ├── index.tsx      # Landing page
│   │   │   ├── login.tsx      # Login page
│   │   │   ├── _authenticated.tsx        # Auth guard layout
│   │   │   └── _authenticated/           # Protected routes
│   │   │       └── dashboard.tsx
│   │   ├── config.ts          # Runtime config (VITE_* env vars)
│   │   ├── main.tsx           # App entry point
│   │   └── globals.css        # Tailwind + CSS custom properties
│   ├── Dockerfile
│   ├── railway.toml           # Railway service config
│   ├── package.json
│   ├── biome.json             # Linter/formatter config
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── backend/                   # Python microservices
│   ├── api_service/           # Core REST API
│   │   ├── __init__.py
│   │   ├── api.py             # FastAPI app + routes
│   │   ├── settings.py        # Pydantic settings (Railway-aware)
│   │   ├── tables.py          # Table definitions + CRUD methods
│   │   ├── schemas.py         # Domain enums
│   │   ├── api_schemas.py     # Request/response Pydantic models
│   │   ├── auth.py            # JWT + password hashing (or OAuth)
│   │   ├── route_metadata.py  # Permission annotations for MCP filtering
│   │   └── Dockerfile
│   ├── mcp_service/           # MCP server (auto-generated from API)
│   │   ├── server.py          # ~10 lines: FastMCP.from_fastapi()
│   │   ├── Dockerfile
│   │   └── AGENTS.md
│   ├── ai_service/            # AI agent service
│   │   ├── app.py             # FastAPI + WebSocket app
│   │   ├── settings.py        # AI-specific settings
│   │   ├── agents/            # Agent framework
│   │   │   ├── base_agent.py  # Abstract base with MCP, streaming, handoffs
│   │   │   └── agent_roles.py # Role-based tool access
│   │   ├── Dockerfile
│   │   └── AGENTS.md
│   ├── lib/                   # Shared library code
│   │   ├── __init__.py
│   │   └── database/
│   │       ├── __init__.py
│   │       ├── database.py    # Database class + connection pool
│   │       └── schemas.py     # Table, Column, Index, Record models
│   ├── scripts/
│   │   └── deploy_tables.py   # Idempotent schema migration
│   ├── .env.example           # Env var template
│   ├── railway.toml           # Railway service config
│   ├── pyproject.toml         # Dependencies + tool config
│   └── uv.lock
│
├── Taskfile.yml               # Task runner (replaces Makefile)
├── .gitignore
└── README.md
```

---

## 3. Frontend Stack

### Core Technology Choices

| Category | Tool | Why |
|---|---|---|
| Package Manager / Runtime | **Bun** | Faster installs, built-in test runner, runs the production server |
| UI Framework | **React 19** | Latest React with concurrent features |
| Routing | **TanStack Router** | Type-safe file-based routing, better than React Router for new projects |
| Styling | **Tailwind CSS v4** | Utility-first, zero-runtime CSS |
| CSS Utilities | `clsx` + `tailwind-merge` + `class-variance-authority` | Conditional classes, merge conflicts, variant props |
| Data Fetching | **TanStack React Query** | Caching, optimistic updates, background refetch |
| Icons | **Lucide React** | Clean, consistent icon library |
| Schema Validation | **Zod** (optional) | Runtime type validation for forms and API responses |
| Rich Text | **Tiptap** (optional) | ProseMirror-based editor if you need rich content |
| Charts | **Recharts** (optional) | Simple charting library for dashboards |
| Linter / Formatter | **Biome** | Single tool replaces ESLint + Prettier, much faster |
| Unit Tests | **Bun test** | Built into Bun, Jest-compatible API |
| E2E Tests | **Playwright** (optional) | Cross-browser E2E testing |

### Runtime Configuration P<!-- attern -->

API URLs are baked into the Vite bundle at build time. Railway auto-injects service variables as Docker build args when they match `ARG` declarations in the Dockerfile:

```typescript
// config.ts
export interface AppConfig {
  apiBaseUrl: string;
}

export function getConfig(): AppConfig {
  return {
    apiBaseUrl: import.meta.env.VITE_API_URL || "/api",
  };
}
```

In development, the Vite dev server proxies `/api` to your local backend. In production, `VITE_API_URL` is set to the real backend URL and baked in at Docker build time.

### Vite Configuration

```typescript
// vite.config.ts
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    TanStackRouterVite({ routesDirectory: "./src/routes" }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
```

The `@` alias lets you write `import { Button } from "@/components/ui/button"` from anywhere in the project.

### API Client Pattern

Create a typed `fetchApi` wrapper with JWT auth and error handling:

```typescript
// api/client.ts
import { getConfig } from "@/config";

const AUTH_TOKEN_KEY = "myapp_token";

export class ApiError extends Error {
  constructor(public status: number, public statusText: string, message?: string) {
    super(message || `API Error: ${status} ${statusText}`);
  }
}

// --- Token management ---
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function removeAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

// --- Fetch wrapper ---
export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { apiBaseUrl } = getConfig();
  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBaseUrl}${endpoint}`, { ...options, headers });

  if (response.status === 401) {
    removeAuthToken();
    window.location.href = "/login";
    throw new ApiError(response.status, response.statusText, "Unauthorized");
  }

  if (!response.ok) {
    let message: string | undefined;
    try { const err = await response.json(); message = err.detail ?? err.error; } catch {}
    throw new ApiError(response.status, response.statusText, message);
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}
```

Then build resource-specific API modules:

```typescript
// api/items.ts
import { fetchApi } from "./client";

export interface Item {
  uuid: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const itemsApi = {
  async list(): Promise<Item[]> {
    return fetchApi<Item[]>("/items");
  },
  async get(id: string): Promise<Item> {
    return fetchApi<Item>(`/items/${id}`);
  },
  async create(data: { name: string }): Promise<Item> {
    return fetchApi<Item>("/items", { method: "POST", body: JSON.stringify(data) });
  },
};
```

### Auth Hook Pattern

Use a React Context + hook for auth state management:

```typescript
// hooks/use-auth.tsx
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { authApi, type User } from "@/api/auth";
import { getAuthToken } from "@/api/client";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const token = getAuthToken();
    if (!token) { setIsLoading(false); return; }
    authApi.getMe()
      .then((u) => setUser(u))
      .catch(() => authApi.logout())
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await authApi.login(email, password);
      setUser(res.user);
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Login failed" };
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    try {
      const res = await authApi.register(email, password);
      setUser(res.user);
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Registration failed" };
    }
  }, []);

  const logout = useCallback(() => { authApi.logout(); setUser(null); }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
```

### Route Guard Pattern

Use TanStack Router's layout route pattern for authenticated sections:

```typescript
// routes/_authenticated.tsx
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({ component: AuthenticatedLayout });

function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return null;
  return <Outlet />;
}
```

All routes under `routes/_authenticated/` are automatically protected. No route-level guards needed.

### App Entry Point

```typescript
// main.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "@/hooks/use-auth";
import { routeTree } from "./routeTree.gen";
import "./globals.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60, retry: 1 } },
});

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router; }
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
```

### Theme System with CSS Custom Properties

Define a design system using HSL CSS variables. This enables light/dark mode and consistent theming:

```css
/* globals.css */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}

:root {
  --background: 220 20% 97%;
  --foreground: 224 21% 15%;
  --card: 0 0% 100%;
  --card-foreground: 224 21% 15%;
  --primary: 225 70% 50%;
  --primary-foreground: 0 0% 100%;
  --secondary: 225 25% 94%;
  --secondary-foreground: 224 21% 15%;
  --muted: 220 15% 95%;
  --muted-foreground: 220 10% 47%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --success: 142 71% 45%;
  --success-foreground: 0 0% 100%;
  --warning: 38 92% 50%;
  --warning-foreground: 0 0% 100%;
  --border: 220 20% 91%;
  --input: 220 20% 91%;
  --ring: 225 70% 50%;
  --radius: 0.625rem;
}

.dark {
  --background: 224 21% 12%;
  --foreground: 220 20% 97%;
  /* ... dark mode overrides ... */
}

* { border-color: hsl(var(--border)); }
body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: var(--font-sans);
}
```

Reference variables in Tailwind classes: `bg-[hsl(var(--primary))]`, `text-[hsl(var(--muted-foreground))]`.

### Reusable UI Components with CVA

Use `class-variance-authority` for variant-based component APIs:

```typescript
// components/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm hover:bg-[hsl(var(--primary))]/90",
        destructive: "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] shadow-sm hover:bg-[hsl(var(--destructive))]/90",
        outline: "border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-sm hover:bg-[hsl(var(--accent))]",
        ghost: "hover:bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-8 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  ),
);
Button.displayName = "Button";
export { Button, buttonVariants };
```

The `cn()` utility merges Tailwind classes safely:

```typescript
// lib/cn.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

### Biome Configuration

Single config replaces ESLint + Prettier:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.3.15/schema.json",
  "files": {
    "includes": ["**/src/**/*", "**/vite.config.ts", "!**/src/routeTree.gen.ts"]
  },
  "formatter": { "enabled": true, "indentStyle": "tab" },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "javascript": { "formatter": { "quoteStyle": "double" } },
  "css": { "parser": { "cssModules": true, "tailwindDirectives": true } }
}
```

### Frontend Dockerfile

Multi-stage build with Bun. `VITE_API_URL` is passed as a build arg so Railway can inject it at build time:

```dockerfile
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build-time args: baked into the Vite bundle at build time
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

CMD ["sh", "-c", "bunx serve dist -s -l tcp://0.0.0.0:${PORT:-3000}"]
```

---

## 4. Backend Stack

### Core Technology Choices

| Category | Tool | Why |
|---|---|---|
| Language | **Python 3.12+** | Type hints, performance improvements, broad ecosystem |
| Package Manager | **uv** (by Astral) | 10-100x faster than pip, replaces pip + virtualenv + poetry |
| Web Framework | **FastAPI** | Async, auto-generated OpenAPI docs, Pydantic integration |
| ASGI Server | **Uvicorn** | Production-grade, supports reload for dev |
| Validation | **Pydantic v2** | Data validation, settings management, schema generation |
| Settings | **pydantic-settings** | Env-var-based config with type coercion |
| Database Driver | **psycopg v3** + **psycopg-pool** | Modern async PostgreSQL driver with connection pooling |
| Auth | **PyJWT** + **bcrypt** | JWT tokens and password hashing |
| Auth (OAuth) | **AuthLib** (optional) | Google/GitHub SSO when needed |
| AI SDK | **OpenAI Agents SDK** (`openai-agents`) | Agent orchestration with tool calling, handoffs, streaming |
| MCP Framework | **FastMCP** (`fastmcp`) | Auto-generate MCP server from FastAPI app |
| Linter / Formatter | **Ruff** | Replaces flake8 + isort + black, extremely fast |
| Testing | **pytest** + **pytest-asyncio** | Standard Python testing with async support |

### pyproject.toml

```toml
[project]
name = "myapp-backend"
version = "0.1.0"
description = "MyApp backend services"
requires-python = ">=3.12"
dependencies = [
    "bcrypt>=4.0.0",
    "fastapi>=0.115.0",
    "fastmcp>=2.0.0",
    "httpx>=0.27.0",
    "psycopg-pool>=3.3.0",
    "psycopg[binary]>=3.3.2",
    "pydantic>=2.12.0",
    "pydantic-settings>=2.12.0",
    "PyJWT>=2.8.0",
    "python-multipart>=0.0.9",
    "uvicorn[standard]>=0.34.0",
]

[project.optional-dependencies]
dev = [
    "ruff>=0.4.0",
    "pytest>=9.0.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.27.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
include = ["api_service*", "ai_service*", "mcp_service*", "lib*"]

[tool.ruff]
target-version = "py312"
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "I", "W"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

### Settings Pattern (Railway-Aware)

Railway provides a `DATABASE_URL` env var when you link a Postgres addon, and injects `PORT` for the web service. The settings class handles both Railway and local dev seamlessly:

```python
# api_service/settings.py
import os
from urllib.parse import quote
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database -- Railway provides DATABASE_URL; individual vars are for local dev
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "myapp"
    db_user: str = "postgres"
    db_password: str = "postgres"
    db_sslmode: str = "prefer"

    # Server -- Railway injects PORT; fall back to 8080 for local dev
    api_host: str = "0.0.0.0"
    api_port: int = int(os.environ.get("PORT") or "8080")
    api_reload: bool = True

    # Auth
    jwt_secret: str = "dev-secret-change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24

    # CORS
    frontend_url: str = "http://localhost:5173"

    @property
    def database_url(self) -> str:
        """Return DATABASE_URL if set (Railway), otherwise construct from individual vars."""
        env_url = os.environ.get("DATABASE_URL")
        if env_url:
            return env_url
        encoded_password = quote(self.db_password, safe="")
        return (
            f"postgresql://{self.db_user}:{encoded_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
            f"?sslmode={self.db_sslmode}"
        )

settings = Settings()
```

**Key Railway integration points:**
- `DATABASE_URL` is auto-set by Railway when you link a Postgres service
- `PORT` is auto-injected by Railway for each web service
- The `database_url` property checks for `DATABASE_URL` first, then falls back to individual vars for local dev

### FastAPI Application Structure

```python
# api_service/api.py
import logging
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from api_service.auth import get_current_user
from api_service.settings import settings
from api_service.tables import ItemTable
from lib.database.database import close_pool, warmup_pool

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warmup DB pool on startup, close on shutdown."""
    warmup_pool()
    yield
    close_pool()

app = FastAPI(title="MyApp API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# --- Table instances ---
item_table = ItemTable()

# --- Health ---
@app.get("/health")
async def health_check():
    return {"message": "healthy"}

# --- Items (example CRUD) ---
@app.get("/items")
async def list_items(current_user: dict = Depends(get_current_user)):
    return item_table.get_all()

@app.post("/items")
async def create_item(request: CreateItemRequest, current_user: dict = Depends(get_current_user)):
    result = item_table.create(name=request.name, owner_uuid=current_user["uuid"])
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create item")
    return result

# --- Run ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_service.api:app", host=settings.api_host, port=settings.api_port, reload=settings.api_reload)
```

### Authentication (JWT + bcrypt)

```python
# api_service/auth.py
import logging
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from api_service.settings import settings

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

def create_token(user_uuid: str, email: str) -> str:
    payload = {
        "sub": user_uuid,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiration_hours),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> dict:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    return {"uuid": payload["sub"], "email": payload["email"]}
```

### Route Metadata for MCP Tool Filtering

Annotate every route with resource and permission metadata. This lets the AI agent framework filter which tools are available to each agent role:

```python
# api_service/route_metadata.py
from api_service.schemas import Permission, Resource

def route_metadata(resource: Resource, permission: Permission) -> dict:
    return {"x-resource": resource.value, "x-permission": permission.value}
```

```python
# api_service/schemas.py
from enum import Enum

class Resource(str, Enum):
    HEALTH = "health"
    AUTH = "auth"
    USER = "user"
    ITEM = "item"

class Permission(str, Enum):
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"
```

Usage:

```python
@app.get("/items", openapi_extra=route_metadata(Resource.ITEM, Permission.READ))
async def list_items(): ...

@app.post("/items", openapi_extra=route_metadata(Resource.ITEM, Permission.WRITE))
async def create_item(): ...
```

### Backend Dockerfile Pattern

All Python services share the same pattern:

```dockerfile
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
COPY pyproject.toml ./
RUN uv pip install --system --no-cache -r pyproject.toml

COPY api_service/ ./api_service/
COPY lib/ ./lib/

ENV PYTHONUNBUFFERED=1
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import os; import urllib.request; urllib.request.urlopen(f'http://localhost:{os.environ.get(\"PORT\",\"8080\")}/health')"

CMD sh -c "uvicorn api_service.api:app --host 0.0.0.0 --port ${PORT:-8080}"
```

The key trick: `COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/` gives you uv in a slim Python image without installing anything extra. The `${PORT:-8080}` pattern respects Railway's injected port.

---

## 5. Database Layer

### Philosophy: ORM-Free with Pydantic Schemas

Instead of SQLAlchemy or an ORM, define your tables as Pydantic models that generate raw SQL. This gives you full control over queries while still having type-safe schema definitions.

### Schema System

```python
# lib/database/schemas.py
from enum import Enum
from typing import Any
from pydantic import BaseModel

class ColumnType(str, Enum):
    TEXT = "TEXT"
    INTEGER = "INTEGER"
    REAL = "REAL"
    BOOLEAN = "BOOLEAN"
    TIMESTAMPTZ = "TIMESTAMPTZ"
    UUID = "UUID"
    JSONB = "JSONB"

class Column(BaseModel):
    name: str
    column_type: ColumnType
    nullable: bool = True
    primary_key: bool = False
    unique: bool = False
    default: str | None = None

    def to_sql(self) -> str:
        parts = [self.name, self.column_type.value]
        if self.primary_key:
            parts.append("PRIMARY KEY")
        if not self.nullable and not self.primary_key:
            parts.append("NOT NULL")
        if self.unique and not self.primary_key:
            parts.append("UNIQUE")
        if self.default is not None:
            parts.append(f"DEFAULT {self.default}")
        return " ".join(parts)

class Index(BaseModel):
    name: str
    columns: list[str]
    unique: bool = False
    method: str = "btree"                    # btree, gin, gist
    operator_class: str | None = None        # e.g., gin_trgm_ops

    def to_create_sql(self, table_fqn: str) -> str:
        unique = "UNIQUE " if self.unique else ""
        method = f"USING {self.method} " if self.method != "btree" else ""
        if self.operator_class:
            columns = ", ".join(f"{col} {self.operator_class}" for col in self.columns)
        else:
            columns = ", ".join(self.columns)
        return f"CREATE {unique}INDEX IF NOT EXISTS {self.name} ON {table_fqn} {method}({columns})"

class Table(BaseModel):
    name: str
    schema_name: str = "public"
    columns: list[Column] = []
    indexes: list[Index] = []

    @property
    def fully_qualified_name(self) -> str:
        return f"{self.schema_name}.{self.name}"

    def to_create_sql(self) -> str:
        column_defs = ",\n    ".join(col.to_sql() for col in self.columns)
        return f"CREATE TABLE IF NOT EXISTS {self.fully_qualified_name} (\n    {column_defs}\n)"

    def to_create_indexes_sql(self) -> list[str]:
        return [idx.to_create_sql(self.fully_qualified_name) for idx in self.indexes]

class Record(BaseModel):
    data: dict[str, Any]
```

### Defining Tables

Each table is a subclass of `Table` with CRUD methods:

```python
# api_service/tables.py
from typing import Any
from lib.database.database import Database
from lib.database.schemas import Column, ColumnType, Index, Record, Table

class UserLoginTable(Table):
    name: str = "user_login"
    columns: list[Column] = [
        Column(name="uuid", column_type=ColumnType.UUID, primary_key=True, default="gen_random_uuid()"),
        Column(name="email", column_type=ColumnType.TEXT, nullable=False, unique=True),
        Column(name="password_hash", column_type=ColumnType.TEXT, nullable=False),
        Column(name="created_at", column_type=ColumnType.TIMESTAMPTZ, default="now()"),
        Column(name="updated_at", column_type=ColumnType.TIMESTAMPTZ, default="now()"),
    ]
    indexes: list[Index] = [
        Index(name="idx_user_login_email", columns=["email"], unique=True),
    ]

    def get_by_email(self, email: str) -> dict[str, Any] | None:
        db = Database()
        with db:
            result = db.execute(
                f"SELECT * FROM {self.fully_qualified_name} WHERE email = %s",
                params=(email,), fetch=True,
            )
        return result[0] if result else None

    def get_by_uuid(self, uuid: str) -> dict[str, Any] | None:
        db = Database()
        with db:
            result = db.execute(
                f"SELECT * FROM {self.fully_qualified_name} WHERE uuid = %s",
                params=(uuid,), fetch=True,
            )
        return result[0] if result else None

    def create(self, email: str, password_hash: str) -> dict[str, Any] | None:
        db = Database()
        with db:
            return db.insert(self, Record(data={"email": email, "password_hash": password_hash}))

class ItemTable(Table):
    name: str = "items"
    columns: list[Column] = [
        Column(name="uuid", column_type=ColumnType.UUID, primary_key=True, default="gen_random_uuid()"),
        Column(name="name", column_type=ColumnType.TEXT, nullable=False),
        Column(name="owner_uuid", column_type=ColumnType.UUID, nullable=False),
        Column(name="status", column_type=ColumnType.TEXT, nullable=False, default="'active'"),
        Column(name="created_at", column_type=ColumnType.TIMESTAMPTZ, default="now()"),
        Column(name="updated_at", column_type=ColumnType.TIMESTAMPTZ, default="now()"),
    ]
    indexes: list[Index] = [
        Index(name="idx_items_owner", columns=["owner_uuid"]),
    ]

    def get_all(self) -> list[dict[str, Any]]:
        db = Database()
        with db:
            return db.execute(
                f"SELECT * FROM {self.fully_qualified_name} ORDER BY created_at DESC",
                fetch=True,
            ) or []

    def get_by_uuid(self, uuid: str) -> dict[str, Any] | None:
        db = Database()
        with db:
            result = db.execute(
                f"SELECT * FROM {self.fully_qualified_name} WHERE uuid = %s",
                params=(uuid,), fetch=True,
            )
        return result[0] if result else None

    def create(self, name: str, owner_uuid: str) -> dict[str, Any] | None:
        db = Database()
        with db:
            return db.insert(self, Record(data={"name": name, "owner_uuid": owner_uuid}))

    def count(self) -> int:
        db = Database()
        with db:
            result = db.execute(f"SELECT COUNT(*) AS count FROM {self.fully_qualified_name}", fetch=True)
        return result[0]["count"] if result else 0
```

### Connection Pool

A singleton `ConnectionPool` eliminates per-query connection overhead:

```python
# lib/database/database.py
import logging
from typing import Any
import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from pydantic import BaseModel
from lib.database.schemas import Record, Table

logger = logging.getLogger(__name__)
_pool: ConnectionPool | None = None

def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        from api_service.settings import settings
        _pool = ConnectionPool(
            conninfo=settings.database_url,
            min_size=2, max_size=10, open=True,
            kwargs={"row_factory": dict_row},
            check=ConnectionPool.check_connection,
            max_idle=300,
        )
    return _pool

def warmup_pool() -> None:
    pool = get_pool()
    with pool.connection() as conn:
        conn.execute("SELECT 1")
    logger.info("Database connection pool warmed up")

def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
        logger.info("Database connection pool closed")

class Database(BaseModel):
    model_config = {"arbitrary_types_allowed": True}
    _connection: psycopg.Connection | None = None

    def connect(self) -> psycopg.Connection:
        if self._connection is None or self._connection.closed:
            self._connection = get_pool().getconn()
        return self._connection

    def disconnect(self) -> None:
        if self._connection is not None:
            get_pool().putconn(self._connection)
            self._connection = None

    def execute(self, sql: str, params=None, fetch: bool = False) -> list[dict[str, Any]] | None:
        conn = self.connect()
        with conn.cursor() as cursor:
            cursor.execute(sql, params)
            if fetch:
                return [dict(row) for row in cursor.fetchall()]
            conn.commit()
            return None

    def execute_atomic(self, statements: list[tuple[str, tuple | dict | None]]) -> None:
        """Execute multiple statements in a single transaction."""
        conn = self.connect()
        try:
            with conn.cursor() as cursor:
                for sql, params in statements:
                    cursor.execute(sql, params)
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    def insert(self, table: Table, record: Record) -> dict[str, Any] | None:
        columns = list(record.data.keys())
        placeholders = [f"%({col})s" for col in columns]
        sql = (
            f"INSERT INTO {table.fully_qualified_name} "
            f"({', '.join(columns)}) VALUES ({', '.join(placeholders)}) RETURNING *"
        )
        conn = self.connect()
        with conn.cursor() as cursor:
            cursor.execute(sql, record.data)
            result = cursor.fetchone()
            conn.commit()
            return dict(result) if result else None

    def create_table(self, table: Table) -> None:
        self.execute(table.to_create_sql())
        for index_sql in table.to_create_indexes_sql():
            self.execute(index_sql)

    def drop_table(self, table: Table) -> None:
        self.execute(f"DROP TABLE IF EXISTS {table.fully_qualified_name} CASCADE")

    def __enter__(self) -> "Database":
        self.connect(); return self

    def __exit__(self, *args: Any) -> None:
        self.disconnect()
```

### Schema Migration

An idempotent `deploy_tables.py` script creates tables and indexes:

```python
# scripts/deploy_tables.py
import logging
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
sys.path.insert(0, ".")

from api_service.tables import ItemTable, UserLoginTable
from lib.database.database import Database

ALL_TABLES = [UserLoginTable(), ItemTable()]

def deploy(reset: bool = False) -> None:
    db = Database()
    with db:
        if reset:
            logger.warning("RESETTING: Dropping all tables...")
            for table in reversed(ALL_TABLES):
                db.drop_table(table)
                logger.info(f"  Dropped: {table.fully_qualified_name}")

        logger.info("Creating tables...")
        for table in ALL_TABLES:
            db.create_table(table)
            logger.info(f"  Created: {table.fully_qualified_name}")

        db.connect().commit()
    logger.info("Schema deployment complete.")

if __name__ == "__main__":
    reset = "--reset" in sys.argv
    deploy(reset=reset)
```

This runs during CI/CD before deploying new container images, so the schema is always in sync. It uses `CREATE TABLE IF NOT EXISTS` so it is safe to run multiple times.

---

## 6. AI and MCP Architecture

> **Note:** This section is optional. You can skip it entirely and add AI capabilities later. The core app (frontend + API + Postgres) works without any AI services.

### The MCP Service (3 Lines of Code)

The MCP service automatically wraps your entire FastAPI app as MCP tools:

```python
# mcp_service/server.py
from fastmcp import FastMCP
from api_service.api import app as fastapi_app

mcp = FastMCP.from_fastapi(app=fastapi_app, name="MyApp MCP")

if __name__ == "__main__":
    import sys
    if "--sse" in sys.argv:
        mcp.run(transport="sse", host="0.0.0.0", port=8080)
    else:
        mcp.run()  # stdio mode for local dev
```

Every FastAPI endpoint becomes an MCP tool. The AI agent can call `list_items`, `create_item`, etc., exactly matching your API's `operation_id`.

### The AI Service

A separate FastAPI app with both REST and WebSocket endpoints for streaming AI chat:

```python
# ai_service/app.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI(title="MyApp AI Service", version="0.1.0")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.websocket("/agent/ws")
async def agent_websocket(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_json()
        agent = MyAgent()
        async for event in agent.run_streamed(data["prompt"]):
            await websocket.send_json(event)
```

### BaseAgent Pattern

All agents inherit from an abstract base class that handles MCP connection, streaming, and role-based tool filtering:

```python
# ai_service/agents/base_agent.py
from abc import ABC, abstractmethod
from agents import Agent, Runner, ModelSettings
from agents.mcp import MCPServerSse

class BaseAgent(ABC):
    @property
    @abstractmethod
    def agent_name(self) -> str: ...

    @property
    @abstractmethod
    def tools(self) -> list: ...

    @property
    @abstractmethod
    def roles(self) -> list: ...

    async def run_streamed(self, prompt: str):
        async with MCPServerSse(name="MyApp MCP", params={"url": settings.mcp_server_url}) as mcp_server:
            agent = Agent(
                name=self.agent_name,
                instructions="Your system prompt here",
                tools=self.tools,
                mcp_servers=[mcp_server],
            )
            async for event in Runner.run_streamed(agent, prompt):
                yield {"type": "stream", "data": event.text}
            yield {"type": "done"}
```

### Role-Based MCP Tool Filtering

Agents filter which MCP tools they can access using the `x-resource` and `x-permission` metadata from the API's OpenAPI spec:

```
Agent roles:  items(WRITE), users(READ)
                    │
MCP tool: create_item
   metadata: resource=item, permission=write
   → items role has WRITE >= write → ALLOWED

MCP tool: delete_user
   metadata: resource=user, permission=admin
   → users role has READ < admin → BLOCKED
```

---

## 7. Deployment with Railway

### Why Railway

- **No infrastructure management** -- no Terraform, no Kubernetes, no cloud console
- **Git-based deploys** -- push to a branch, Railway builds and deploys automatically
- **Built-in Postgres** -- one click to add a database, connection string auto-injected
- **Environment-based** -- separate environments with independent config
- **Docker native** -- uses your Dockerfiles directly
- **Preview environments** -- optional per-PR environments

### Project Structure on Railway

Create one Railway project with three environments:

```
Railway Project: "myapp"
├── Environment: local       (not on Railway -- your local Docker Postgres)
├── Environment: staging     (auto-deploy from main branch)
└── Environment: production  (manual promote or deploy from release branch)
```

Each environment contains the same services with different config:

```
Services per environment:
├── myapp-api        (backend API service)
├── myapp-frontend   (frontend static server)
├── myapp-postgres   (Railway Postgres addon)
├── myapp-mcp        (optional: MCP service)
└── myapp-ai         (optional: AI service)
```

### railway.toml Configuration

Each service gets a `railway.toml` in its directory:

**Backend (api_service):**

```toml
# backend/railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "api_service/Dockerfile"

[deploy]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
healthcheckPath = "/health"
```

**Frontend:**

```toml
# frontend/railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### Railway Service Configuration

In the Railway dashboard, configure each service:

| Service | Root Directory | Key Env Vars |
|---|---|---|
| myapp-api | `backend/` | `DATABASE_URL` (auto from Postgres link), `JWT_SECRET`, `FRONTEND_URL` |
| myapp-frontend | `frontend/` | `VITE_API_URL` (set to API service URL) |
| myapp-postgres | (Railway addon) | Auto-provides `DATABASE_URL` |
| myapp-mcp | `backend/` | `DATABASE_URL` (link to same Postgres) |
| myapp-ai | `backend/` | `AI_SERVICE_*` vars, `AI_SERVICE_MCP_SERVER_URL`, `AI_SERVICE_API_SERVICE_URL` |

### How Railway Injects Config

1. **DATABASE_URL**: When you link a Postgres addon to a service, Railway auto-injects `DATABASE_URL` as an env var. Your `settings.py` reads this first.
2. **PORT**: Railway auto-injects `PORT` for every web service. Your Dockerfile CMD uses `${PORT:-8080}`.
3. **Service Variables**: Set `VITE_API_URL`, `JWT_SECRET`, etc. in the Railway dashboard. For the frontend, `VITE_*` vars are injected as Docker build args.

### Environment Strategy

| | Local | Staging | Production |
|---|---|---|---|
| Database | Docker Postgres container | Railway Postgres (staging) | Railway Postgres (production) |
| Deploy trigger | Manual (`task api_service:dev`) | Auto on push to `main` | Manual promote or push to `release` |
| Frontend URL | `http://localhost:5173` | `https://myapp-staging.up.railway.app` | `https://app.myapp.com` |
| API URL | `http://localhost:8080` | `https://myapp-api-staging.up.railway.app` | `https://api.myapp.com` |

### Local Postgres with Docker

For local development, run Postgres in Docker:

```bash
# Create and start a local Postgres container
docker run -d --name myapp-db \
  -e POSTGRES_DB=myapp \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16
```

Then point your `.env.local` at it:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSLMODE=prefer
```

### Custom Domains

Railway supports custom domains per environment. In production:
- Frontend: `app.myapp.com` → myapp-frontend service
- API: `api.myapp.com` → myapp-api service

Configure these in the Railway dashboard under each service's Settings > Networking.

---

## 8. CI/CD (GitHub Actions)

### Branch Strategy

| Branch | Environment | Trigger |
|---|---|---|
| `main` | staging | Automatic on push (Railway auto-deploy) |
| `release` or `v*` tag | production | Automatic on push (Railway auto-deploy) |
| Pull Requests | n/a | CI checks only (no deploy) |

Railway handles deploys automatically when you push to connected branches. GitHub Actions handles CI checks (lint, test) on PRs.

### CI Pipeline (ci.yml)

Runs on every PR. Uses path-based change detection to only test what changed:

```yaml
name: CI
on:
  pull_request:
    branches: [main, release]

jobs:
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
        with: { python-version: '3.12' }
      - uses: astral-sh/setup-uv@v4
      - run: uv sync --extra dev
      - run: uv run ruff check .
      - run: uv run ruff format --check .
      - run: uv run pytest tests/ -v

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
      - run: bun run check
```

### Deploy Pipeline

Railway handles deployments automatically via its GitHub integration. When you connect your repo:

1. Railway watches the `main` branch → deploys to staging environment
2. Railway watches the `release` branch → deploys to production environment
3. Each service's `railway.toml` tells Railway which Dockerfile to use

No GitHub Actions deploy pipeline needed -- Railway's built-in CI/CD handles it.

### Database Migration Before Deploy

To run `deploy_tables.py` before each deploy, add it to your Dockerfile or use a Railway deploy hook. The simplest approach is to make it part of the container startup:

```dockerfile
# In the CMD, run migrations then start the server
CMD sh -c "python scripts/deploy_tables.py && uvicorn api_service.api:app --host 0.0.0.0 --port ${PORT:-8080}"
```

Since `deploy_tables.py` uses `CREATE TABLE IF NOT EXISTS`, running it on every startup is idempotent and safe.

---

## 9. Developer Tooling

### Taskfile (Replaces Makefile)

Install [Task](https://taskfile.dev). A single `Taskfile.yml` at the repo root provides namespaced commands for every workflow.

#### Design Principles

- **Namespaced tasks** -- `service:action` convention (`api_service:dev`, `frontend:dev`)
- **dotenv integration** -- Tasks that need environment variables use `dotenv:` to load from `.env.local` (or `.env.{ENV}`)
- **`dir:` for working directory** -- Each task runs in the right directory; no `cd` needed

#### Complete Taskfile

```yaml
version: '3'

tasks:
  # ─────────────────────────────────────────────
  # Install All Dependencies
  # ─────────────────────────────────────────────
  install:
    desc: Install all dependencies (backend + frontend)
    cmds:
      - task: backend:install
      - task: frontend:install

  # ─────────────────────────────────────────────
  # Backend
  # ─────────────────────────────────────────────
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

  # ─────────────────────────────────────────────
  # API Service
  # ─────────────────────────────────────────────
  api_service:dev:
    desc: "Run API server locally. Usage: task api_service:dev [ENV=local]"
    dir: backend
    dotenv:
      - '.env.{{.ENV | default "local"}}'
    cmds:
      - uv run python -m api_service.api

  # ─────────────────────────────────────────────
  # MCP Service (optional)
  # ─────────────────────────────────────────────
  mcp_service:dev:
    desc: Run MCP server in stdio mode
    dir: backend
    dotenv:
      - '.env.{{.ENV | default "local"}}'
    cmds:
      - uv run python -m mcp_service.server

  mcp_service:dev:sse:
    desc: Run MCP server in SSE mode
    dir: backend
    dotenv:
      - '.env.{{.ENV | default "local"}}'
    cmds:
      - uv run python -m mcp_service.server --sse

  mcp_service:inspect:
    desc: Run MCP Inspector for interactive tool debugging
    dir: backend
    dotenv:
      - '.env.{{.ENV | default "local"}}'
    cmds:
      - npx @modelcontextprotocol/inspector uv run python -m mcp_service.server

  # ─────────────────────────────────────────────
  # AI Service (optional)
  # ─────────────────────────────────────────────
  ai_service:dev:
    desc: Run AI service locally with hot reload
    dir: backend
    dotenv:
      - '.env.{{.ENV | default "local"}}'
    cmds:
      - uv run python -m ai_service.app

  # ─────────────────────────────────────────────
  # Frontend
  # ─────────────────────────────────────────────
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

  frontend:lint:
    desc: Run Biome linter
    dir: frontend
    cmds:
      - bun run lint

  frontend:format:
    desc: Format with Biome
    dir: frontend
    cmds:
      - bun run format

  frontend:check:
    desc: Run Biome check
    dir: frontend
    cmds:
      - bun run check

  frontend:preview:
    desc: Preview production build locally
    dir: frontend
    cmds:
      - bun run preview

  # ─────────────────────────────────────────────
  # Docker
  # ─────────────────────────────────────────────
  docker:api:build:
    desc: Build API service Docker image
    dir: backend
    cmds:
      - docker build -f api_service/Dockerfile -t myapp-api:local .

  docker:api:run:
    desc: Run API service via Docker
    dir: backend
    cmds:
      - docker run -p 8080:8080 --env-file '.env.{{.ENV | default "local"}}' myapp-api:local

  docker:frontend:build:
    desc: "Build frontend Docker image. Usage: task docker:frontend:build [VITE_API_URL=http://localhost:8080]"
    dir: frontend
    cmds:
      - docker build --build-arg VITE_API_URL={{.VITE_API_URL | default "http://localhost:8080"}} -t myapp-frontend:local .

  docker:frontend:run:
    desc: Run frontend via Docker
    dir: frontend
    cmds:
      - docker run -p 3000:3000 myapp-frontend:local

  # ─────────────────────────────────────────────
  # Linting (all)
  # ─────────────────────────────────────────────
  lint:
    desc: Run all linters (backend + frontend)
    cmds:
      - task: backend:check
      - task: frontend:check

  # ─────────────────────────────────────────────
  # Database
  # ─────────────────────────────────────────────
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
      - uv run python scripts/deploy_tables.py

  db:reset:
    desc: "Drop and recreate all tables (DESTRUCTIVE). Usage: task db:reset [ENV=local]"
    dir: backend
    dotenv:
      - '.env.{{.ENV | default "local"}}'
    cmds:
      - uv run python scripts/deploy_tables.py --reset

  db:psql:
    desc: "Open interactive psql session. Usage: task db:psql [ENV=local]"
    dir: backend
    dotenv:
      - '.env.{{.ENV | default "local"}}'
    cmds:
      - psql "${DATABASE_URL:-postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=$DB_SSLMODE}"

  db:query:
    desc: "Run a SQL query. Usage: task db:query SQL='SELECT 1' [ENV=local]"
    dir: backend
    dotenv:
      - '.env.{{.ENV | default "local"}}'
    requires:
      vars: [SQL]
    cmds:
      - psql "${DATABASE_URL:-postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=$DB_SSLMODE}" -c "{{.SQL}}"

  # ─────────────────────────────────────────────
  # Testing
  # ─────────────────────────────────────────────
  test:backend:
    desc: Run all backend tests
    dir: backend
    dotenv:
      - '.env.{{.ENV | default "local"}}'
    cmds:
      - uv run pytest tests/ -v

  test:frontend:
    desc: Run frontend tests
    dir: frontend
    cmds:
      - bun run test
```

#### Quick Reference

```bash
# ── First-time setup ──
task install                             # Install backend + frontend
task db:create                           # Start local Postgres in Docker
task db:deploy                           # Create tables

# ── Development (2-4 terminals) ──
task api_service:dev                     # API on :8080
task frontend:dev                        # Frontend on :5173
task mcp_service:dev:sse                 # MCP on :8080 (optional)
task ai_service:dev                      # AI on :8001 (optional)

# ── Linting & testing ──
task lint                                # Backend + frontend combined
task test:backend                        # pytest
task test:frontend                       # bun test

# ── Database ──
task db:deploy                           # Create tables (idempotent)
task db:reset                            # Drop + recreate (DESTRUCTIVE)
task db:psql                             # Interactive psql session
task db:query SQL='SELECT count(*) FROM public.items'
```

### Environment Files

```bash
# backend/.env.example
# Copy to .env.local for local dev.
# On Railway, DATABASE_URL is set automatically by the Postgres addon.
DATABASE_URL=
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSLMODE=prefer

# Auth
JWT_SECRET=change-me-in-production

# Server
PORT=
API_HOST=0.0.0.0
API_RELOAD=true
FRONTEND_URL=http://localhost:5173

# AI Service (optional, prefixed with AI_SERVICE_)
AI_SERVICE_HOST=0.0.0.0
AI_SERVICE_PORT=8001
AI_SERVICE_MCP_SERVER_URL=http://localhost:8080/sse
AI_SERVICE_API_SERVICE_URL=http://localhost:8080
AI_SERVICE_AI_PROVIDER_API_KEY=
AI_SERVICE_AI_PROVIDER_ENDPOINT=
AI_SERVICE_AI_PROVIDER_MODEL=
```

### .gitignore

```gitignore
# Node / Bun
node_modules/
bun.lock

# Environment files (secrets) -- keep .env.example checked in
.env
.env.*
!.env.example

# Byte-compiled / optimized
__pycache__/
*.py[codz]
*$py.class

# Distribution / packaging
build/
dist/
*.egg-info/
*.egg

# Virtual environments
.venv
venv/

# Vite
.vite/

# Testing
.pytest_cache/
.coverage
htmlcov/

# Ruff
.ruff_cache/

# IDE
.idea/
.vscode/

# OS
.DS_Store
Thumbs.db
```

---

## 10. AGENTS.md -- AI Coding Agent Context System

### What It Is

The repo uses a hierarchy of `AGENTS.md` files to give AI coding agents (Cursor, Copilot, Codex, Claude Code, etc.) the context they need to work effectively in each part of the codebase. Think of them as README files written specifically for AI agents rather than humans.

### File Hierarchy

```
myapp/
├── AGENTS.md                          # Root: project overview, architecture, workflow rules
├── frontend/
│   └── AGENTS.md                      # Frontend: runtime, patterns, testing, auth flow
├── backend/
│   ├── AGENTS.md                      # Backend: domain model, code conventions, key patterns
│   ├── api_service/
│   │   └── AGENTS.md                  # API: endpoints, table patterns, auth, route metadata
│   ├── mcp_service/
│   │   └── AGENTS.md                  # MCP: transport modes, tool generation
│   └── ai_service/
│       └── AGENTS.md                  # AI: agent classes, roles, WebSocket protocol
```

### Standard Sections per File

- **Overview** -- What the area does in 1-2 sentences
- **File structure** -- Annotated directory listing
- **Key components** -- Important classes/modules with usage examples
- **Configuration** -- Environment variables table with defaults
- **Code patterns** -- How to do common tasks, with code snippets
- **Running the service** -- How to start it locally
- **Testing** -- How to run tests, what to test
- **Mandatory update rules** -- What to update when modifying this area
- **Anti-patterns** -- What NOT to do

### Root AGENTS.md Content

The root file should cover:

1. **Service map** -- Architecture diagram and communication table
2. **Links to area files** -- Table linking to each service's AGENTS.md
3. **Workflow rules** -- How the AI agent should approach tasks:
   - Plan mode for non-trivial tasks
   - Write/update tests to define behavior
   - Verify before marking complete
   - Update AGENTS.md when modifying a service
4. **Key patterns** -- Cross-cutting conventions like "only `api_service` accesses the database directly"

### Cursor-Specific Config

```
.cursor/
├── rules/
│   ├── cli-single-line.mdc       # Combine CLI commands with &&
│   └── use-taskfile.mdc          # Always use `task <name>` instead of raw commands
├── skills/
│   └── testing/SKILL.md          # When/how to write tests
└── mcp.json                      # Wire up MCP server as a Cursor tool
```

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "myapp": {
      "command": "task",
      "args": ["mcp_service:dev"]
    }
  }
}
```

---

## 11. Getting Started Checklist

### Prerequisites

- [ ] [Bun](https://bun.sh) installed
- [ ] [Python 3.12+](https://python.org) installed
- [ ] [uv](https://docs.astral.sh/uv/) installed (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- [ ] [Task](https://taskfile.dev) installed
- [ ] [Docker](https://docs.docker.com/engine/install/) installed
- [ ] [Railway CLI](https://docs.railway.com/guides/cli) installed (optional, for deploys)
- [ ] Railway account at [railway.com](https://railway.com)
- [ ] GitHub repository

### Step-by-Step

1. **Create the monorepo structure** using the layout in Section 2
2. **Set up the backend**
   - Create `pyproject.toml` with dependencies from Section 4
   - Implement `lib/database/schemas.py` and `lib/database/database.py`
   - Build your first table in `api_service/tables.py`
   - Create the FastAPI app in `api_service/api.py`
   - Add settings in `api_service/settings.py`
   - Add auth in `api_service/auth.py`
3. **Set up the frontend**
   - Initialize with `bun create vite frontend --template react-ts`
   - Add TanStack Router, React Query, Tailwind CSS v4, Biome
   - Create the API client, auth hook, and routes
   - Set up Biome for linting/formatting
4. **Set up local database**
   - `task db:create` to start Postgres in Docker
   - Copy `.env.example` to `.env.local`
   - `task db:deploy` to create tables
5. **Set up dev tooling**
   - Create `Taskfile.yml`
   - Create `.gitignore`
   - Run `task install`
6. **Run locally**
   - `task api_service:dev` in one terminal
   - `task frontend:dev` in another
   - Visit `http://localhost:5173`
7. **Deploy to Railway**
   - Create a new Railway project
   - Add a Postgres addon
   - Add a backend service (root: `backend/`, Dockerfile: `api_service/Dockerfile`)
   - Add a frontend service (root: `frontend/`)
   - Set env vars: `JWT_SECRET`, `FRONTEND_URL`, `VITE_API_URL`
   - Link Postgres to the backend service (auto-provides `DATABASE_URL`)
   - Push to `main` → auto-deploy to staging
8. **Set up CI/CD**
   - Add `ci.yml` to `.github/workflows/`
   - Configure Railway GitHub integration for auto-deploys
9. **Add AI capabilities (optional, later)**
   - Create `mcp_service/server.py` (3 lines)
   - Create `ai_service/app.py` with WebSocket streaming
   - Add MCP and AI services to Railway
10. **Set up AGENTS.md**
    - Create root `AGENTS.md` with architecture and workflow rules
    - Create per-service AGENTS.md files
    - Add `.cursor/rules/` and `.cursor/mcp.json`

---

## Summary of Key Design Decisions

| Decision | Choice | Alternative Considered |
|---|---|---|
| Monorepo vs polyrepo | Monorepo | Polyrepo (harder to keep in sync) |
| Frontend runtime | Bun | Node.js (slower installs, no built-in test runner) |
| Frontend framework | React + TanStack | Next.js (more opinionated, heavier) |
| CSS | Tailwind v4 | CSS Modules, styled-components |
| JS linter/formatter | Biome | ESLint + Prettier (two tools, slower) |
| Backend language | Python 3.12 | Go, Rust (less AI ecosystem support) |
| Python package manager | uv | pip + poetry (slower, more complex) |
| Web framework | FastAPI | Flask, Django (less async, slower) |
| Database | PostgreSQL (managed) | MySQL, MongoDB |
| ORM | None (raw SQL + Pydantic) | SQLAlchemy (magic, harder to debug) |
| Python linter/formatter | Ruff | flake8 + black (two tools, slower) |
| AI framework | OpenAI Agents SDK | LangChain (heavier, more abstraction) |
| MCP | FastMCP from_fastapi | Manual MCP tool definitions |
| Deployment platform | Railway | Vercel, Fly.io, AWS (more complex) |
| CI/CD | GitHub Actions + Railway auto-deploy | CircleCI, Jenkins |
| Task runner | Taskfile | Make (less readable, no built-in dotenv) |
| AI agent context | Hierarchical AGENTS.md | Single README (too broad) |

---

*This document is a living blueprint. Adapt it to your domain, swap out pieces that don't fit, and build something great.*

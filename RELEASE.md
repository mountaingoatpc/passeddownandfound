# Release Process Guide

Copy this into another app. It is the exact release process used here: **`main` deploys non-prod; `release` deploys prod.** Cutting a release is an interactive, gated merge + push + GitHub Release — not a separate CI deploy pipeline.

In this repo the platform is [Railway](https://railway.com). Replace Railway with your host if needed; keep the branching and confirmation model.

---

## Mental model

| Branch | Environment | What happens on push |
|--------|-------------|----------------------|
| `main` | Dev / non-prod | Platform auto-deploys (Railway `dev`) |
| `release` | Prod | Platform auto-deploys (Railway `prod`) |

There is no “promote build” button. **Prod is whatever is on `release`.** Getting code to prod means merging `main` into `release` and pushing.

Version tags (e.g. `v1.2.0`) are GitHub Releases pointed at the `release` branch. They document what shipped; they are **not** the deploy trigger.

```
developer work → PR → main ──(auto)──► dev
                         │
              release cut│
                         ▼
                      release ──(push)──► prod
                         │
                         └── gh release create vX.Y.Z --target release
```

---

## Prerequisites

- Clean working tree on `main`
- [GitHub CLI](https://cli.github.com) (`gh`) authenticated (`gh auth status`)
- Long-lived remote branches `main` and `release`
- Platform wired so `main` → non-prod and `release` → prod
- [Task](https://taskfile.dev) (or equivalent) with `lint`, `test:backend`, and optional `db:deploy`
- Semver tags with a leading `v` (`v1.0.0`)

---

## Two ways to run a release

### A. Interactive Taskfile (human + TTY)

```bash
task release-full VERSION=v1.2.0
```

Each irreversible step prompts before running. Needs a real terminal — Task `prompt:` does not work well for agents or non-interactive CI.

Tag-only shortcut when `release` is already pushed:

```bash
task release VERSION=v1.2.0
```

### B. Agent- or checklist-driven (recommended for AI coding agents)

Do **not** call `task release-full`. Drive the same steps yourself and ask a human at each gate. Track progress:

```
Release Progress:
- [ ] 0. Version + preflight
- [ ] 1. Lint
- [ ] 2. Backend tests
- [ ] 3. Merge main → release
- [ ] 4. Push release (prod deploy)
- [ ] 5. GitHub Release
- [ ] 6. Finish + optional schema deploy
```

---

## Step-by-step

### 0. Version + preflight

1. Choose the next version. Suggest from:

```bash
gh release list --limit 5
git tag -l 'v*' --sort=-v:refname | head -5
```

2. Refuse to continue unless all pass:

```bash
test -z "$(git status --porcelain)"   # clean tree
test "$(git branch --show-current)" = "main"
command -v gh >/dev/null
git fetch origin
```

If dirty or not on `main`: stop and tell the operator what to fix.

If the version tag already exists: warn and ask for a new one — never overwrite.

### 1. Lint

Ask: **Run lint (backend ruff + frontend Biome)?**

```bash
task lint
```

(`task lint` runs backend + frontend checkers.) Fix failures before continuing. Skip only if the human explicitly says to skip.

### 2. Tests

Ask: **Run backend tests?**

```bash
task test:backend
```

Fix failures before continuing. Add frontend / e2e gates here if your app has them.

### 3. Merge `main` into `release`

Ask: **Merge main into release branch?**

```bash
git checkout release
git merge main --no-edit
```

Resolve conflicts with the human if needed. Never force-push.

### 4. Push (triggers prod deploy)

Ask: **Push release branch to origin (triggers Railway prod deploy)?**

```bash
git push origin release
```

This is the irreversible production cut. Confirm explicitly every time.

### 5. GitHub Release

Ask: **Create GitHub Release vX.Y.Z?**

```bash
gh release create vX.Y.Z --target release --generate-notes --latest
```

`--target release` ties the tag to the branch that just deployed, not to `main`.

### 6. Finish

```bash
git checkout main
```

Ask whether this release included **schema / migration changes**. If yes:

```bash
task db:deploy ENV=prod
```

(Or your platform’s equivalent migrate step. Prefer idempotent migrate scripts. In this app, schema may also run migrate-on-boot in the API container; `db:deploy` is the explicit one-off.)

Then verify:

```bash
gh release view vX.Y.Z
# + check the Railway prod deploy / healthchecks
```

---

## Modes

| Intent | What to run |
|--------|-------------|
| Full prod release | Steps 0 → 6 |
| GitHub Release only (`release` already pushed) | Version → step 5 |
| Skip lint / tests | Only if the human explicitly opts out |

---

## Hard rules

- **Never** force-push `release` or `main`
- **Never** skip confirmation on push or GitHub Release
- **Never** reuse an existing version tag; pick a new semver
- Prefer **stop on failure** over continuing; ask how to proceed
- Keep each gate to **one short question**
- Agents: drive steps manually; do not rely on Taskfile interactive prompts

---

## Taskfile release tasks (copy this)

Wire these into `Taskfile.yml` so humans can run `task release-full` when they have a TTY. Namespaced internals stay `internal: true` so `task --list` stays clean.

You must already have (or rename to match):

- `lint` — all linters
- `test:backend` — backend test suite
- optional `db:deploy` — idempotent schema apply with `ENV=`

| Task | Visibility | Role |
|------|------------|------|
| `release-full` | public | Orchestrates the full gated flow; requires `VERSION=` |
| `release` | public | GitHub Release only; requires `VERSION=` |
| `release:preflight` | internal | Clean tree, on `main`, `gh` present, `git fetch` |
| `release:lint` | internal | Prompt → `task lint` |
| `release:test` | internal | Prompt → `task test:backend` |
| `release:merge` | internal | Prompt → merge `main` into `release` |
| `release:push` | internal | Prompt → `git push origin release` |
| `release:gh-release` | internal | Prompt → `gh release create` |
| `release:finish` | internal | Return to `main`; print schema / verify reminders |

```yaml
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
    prompt: "Run lint (backend ruff + frontend Biome)?"
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
    desc: "Release step 4/6 — push release (triggers Railway prod deploy)"
    internal: true
    prompt: "Push release branch to origin (triggers Railway prod deploy)?"
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
        echo "════════════════════════════════════════════════════════════"
        echo "  Release complete."
        echo ""
        echo "  If this release included schema changes, run:"
        echo "    task db:deploy ENV=prod"
        echo ""
        echo "  Verify Railway prod deploy and:"
        echo "    gh release view {{.VERSION}}"
        echo "════════════════════════════════════════════════════════════"
```

Adapt the lint prompt text and “Railway” wording to your stack. Keep the gate order.

---

## Cursor / agent skill (optional)

Keep a short agent skill at `.cursor/skills/release/SKILL.md` that is the agent-facing twin of this doc. The Taskfile is the human-facing twin. Keep them in sync when the process changes.

```markdown
---
name: release
description: >-
  Run an interactive prod release: confirm version, lint, test, merge main
  into release, push (prod deploy), and create a GitHub Release. Use when the
  user asks to release, ship to prod, cut a version, or do a production deploy.
---

# Release

Ship `main` → `release` (prod) interactively. Confirm every irreversible step
with the user before running it.

| Branch | Env | Trigger |
|--------|-----|---------|
| `main` | Dev | Push → platform |
| `release` | Prod | Push → platform |

Do **not** run `task release-full` — Taskfile prompts need a TTY. Drive steps
yourself and ask the user at each gate.

## Workflow

Copy and track progress:

```
Release Progress:
- [ ] 0. Version + preflight
- [ ] 1. Lint
- [ ] 2. Backend tests
- [ ] 3. Merge main → release
- [ ] 4. Push release (prod deploy)
- [ ] 5. GitHub Release
- [ ] 6. Finish + optional db:deploy
```

### 0. Version + preflight

1. Ask for the version tag (e.g. `v1.2.0`). Suggest the next semver from:

```bash
gh release list --limit 5
git tag -l 'v*' --sort=-v:refname | head -5
```

2. Stop unless all pass:

```bash
test -z "$(git status --porcelain)"
test "$(git branch --show-current)" = "main"
command -v gh >/dev/null
git fetch origin
```

### 1–5

Ask one short confirmation per gate, then run:

```bash
task lint
task test:backend
git checkout release && git merge main --no-edit
git push origin release
gh release create {{VERSION}} --target release --generate-notes --latest
```

### 6. Finish

```bash
git checkout main
```

Ask about schema changes; if yes, `task db:deploy ENV=prod`. Verify with
`gh release view {{VERSION}}` and the prod dashboard.

## Rules

- Never force-push `release` or `main`.
- Never skip the push or GitHub Release confirmation.
- Never create a tag/release with a version that already exists.
- Prefer stopping on failure over continuing.
- Skip lint/tests only if the user explicitly says to skip.
```

---

## Platform setup (Railway, as used here)

Per service in the Railway project:

| Setting | Dev env | Prod env |
|---------|---------|----------|
| Connected GitHub repo | same | same |
| Branch | `main` | `release` |

There is no GitHub Actions deploy job. CI (lint/test) can live in Actions or Taskfile; Railway only builds what you push to the connected branch.

First-time setup in the other app:

1. Create branch `release` from a known-good `main` and push it.
2. Point non-prod auto-deploy at `main`, prod at `release`.
3. Copy the Taskfile block (and optional agent skill).
4. Point `release:lint` / `release:test` at your quality gates.
5. Replace `task db:deploy ENV=prod` with your migration story (or drop it if migrate-on-boot is enough).

---

## Quick reference

```bash
# Human, interactive
task release-full VERSION=v1.2.0

# Tag only
task release VERSION=v1.2.0

# Manual / agent gates (after preflight)
task lint
task test:backend
git checkout release && git merge main --no-edit
git push origin release
gh release create v1.2.0 --target release --generate-notes --latest
git checkout main
# optional: task db:deploy ENV=prod
gh release view v1.2.0
```

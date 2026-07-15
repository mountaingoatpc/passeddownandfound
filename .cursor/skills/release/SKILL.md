---
name: release
description: >-
  Run an interactive prod release for Passed Down and Found: confirm version,
  lint, test, merge main into release, push (Railway prod deploy), and create a
  GitHub Release. Use when the user asks to release, ship to prod, cut a
  version, or do a production deploy.
---

# Release

Ship `main` → `release` (prod) interactively. Confirm every irreversible step with the user before running it.

| Branch | Env | Trigger |
|--------|-----|---------|
| `main` | Dev | Push → Railway |
| `release` | Prod | Push → Railway |

Do **not** run `task release-full` — Taskfile prompts need a TTY. Drive steps yourself and ask the user at each gate.

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
test -z "$(git status --porcelain)"   # clean tree
test "$(git branch --show-current)" = "main"
command -v gh >/dev/null
git fetch origin
```

If not on `main` or dirty: tell the user what to fix; do not continue.

### 1. Lint — ask: "Run lint (backend ruff + frontend Biome)?"

On yes:

```bash
task lint
```

Fix failures with the user before continuing.

### 2. Backend tests — ask: "Run backend tests?"

On yes:

```bash
task test:backend
```

Fix failures with the user before continuing.

### 3. Merge — ask: "Merge main into release branch?"

On yes:

```bash
git checkout release
git merge main --no-edit
```

Resolve conflicts with the user if needed.

### 4. Push — ask: "Push release to origin? This triggers the Railway prod deploy."

On yes:

```bash
git push origin release
```

### 5. GitHub Release — ask: "Create GitHub Release {{VERSION}}?"

On yes:

```bash
gh release create {{VERSION}} --target release --generate-notes --latest
```

### 6. Finish

```bash
git checkout main
```

Ask whether this release included **schema changes**. If yes:

```bash
task db:deploy ENV=prod
```

Then remind the user to verify Railway prod and:

```bash
gh release view {{VERSION}}
```

## Modes

| User intent | Steps |
|-------------|--------|
| Full prod release | 0 → 6 |
| GitHub Release only (`release` already pushed) | Ask for VERSION → step 5 only |
| Skip lint/tests | Allowed only if user explicitly says to skip |

## Rules

- Never force-push `release` or `main`.
- Never skip the push or GitHub Release confirmation.
- Never create a tag/release with a version that already exists; warn and ask for a new one.
- Prefer stopping on failure over continuing; ask how to proceed.
- Keep confirmations short; one question per gate.

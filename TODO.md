# TODO — CYOA

> **This app builds itself.** You describe what you want, the AI plans it against the actual codebase, you review and approve, and the app applies the change. Every feature below should be submitted as feedback *to this app* and implemented through the same loop it provides. The plane is flying; we're building it in the air.
>
> **EXPERIMENTAL** — this app writes files to its own working tree. Use at your own risk. If it breaks something, `git checkout .` or `git stash` will get you back. That's the rollback plan for now, and that's fine.

## Loop 0 — Bootstrap (done)

The minimum to close the first feedback loop manually: sign in, describe what you want, get a structured plan back, copy it to an agent.

- [x] vinext + App Router scaffold, Docker Compose (mongo:7 + web)
- [x] Google + GitHub OAuth (Auth.js v5)
- [x] Feedback model (MongoDB/Mongoose): `userId`, `title`, `kind`, `text`, context fields, `status`, `aiOutput`
- [x] `POST/GET /api/feedback` (session + Bearer ingest), `POST /api/feedback/:id/process`
- [x] LLM analysis with project-aware system prompt (knows vinext, Mongoose, file layout)
- [x] Safety-biased output: `refused`, `proposedSteps`, `risks`, `outOfScope`, `doNotDo`
- [x] Copy JSON for agent (manual paste into Cursor / CLI)
- [x] Quality gates in prompt: plans must include lint, type check, and test steps

## Loop 1 — Review and approve in the app (done)

Stop copy-pasting. The plan stays in the app, you edit it there, and accepting it triggers the next step.

- [x] **Plan review UI**: show each `proposedStep` as an editable checklist in the feedback modal
- [x] **Accept / edit / reject**: `PATCH /api/feedback/:id` with `{ action: "accept", editedSteps }`. Store `approvedPlan` on the doc
- [x] **Status flow**: `pending` → `processing` → `done` → `approved` → `applying` → `applied` (or `error` / back to `done` on reject)

## Loop 2 — The app writes its own code (done)

Accepted plans become file changes. You see results after apply.

- [x] **Code-gen prompt**: second LLM call (`CODEGEN_SYSTEM` in `lib/prompts.ts`) takes `approvedPlan` + original feedback and returns file patches as JSON (`{ files: [{ path, action, content }] }`)
- [x] **Apply**: `POST /api/feedback/:id/apply` runs code generation, writes patches to the working tree, and reports what was created/edited/deleted
- [x] **Verify after apply**: auto-runs `npm run lint`, `npx tsc --noEmit`, `npm run test` and reports pass/fail in the response
- [x] **Path traversal protection**: apply rejects paths that escape the project root

## Loop 3 — Trust escalation

Not everything needs a human click. Let safe changes flow, gate risky ones.

- [ ] **Risk classification**: tag each step as low/medium/high risk based on what it touches (tests/docs = low, schema/auth/env = high)
- [ ] **Auto-apply low-risk**: user toggles "auto-apply safe changes" — tests, docs, CSS go straight through
- [ ] **Human gate for high-risk**: schema migrations, auth changes, env var additions always require explicit approval
- [ ] **Diff preview UI**: show proposed file changes (before/after) in the modal before applying

## Loop 4 — Git and CI integration

Changes that pass local verification get pushed, reviewed, and deployed.

- [ ] **Branch + PR**: each accepted feedback creates a branch, applies changes, opens a PR
- [ ] **CI verification**: PR triggers CI (lint + types + tests); status reported back to the feedback UI
- [ ] **GitHub Issues**: optionally create an Issue from the original feedback, linked to the PR
- [ ] **Merge flow**: auto-merge if CI passes and risk is low; require review for high-risk
- [ ] **Status webhooks**: feedback UI updates when PR opens, CI passes, merge completes

## Loop 5 — Product wrapper

The same loop, available to other people building other apps.

- [ ] Multi-tenant: per-user apps, keys, and feedback namespaces
- [ ] Per-user BYOK: choose provider + model, store encrypted API key, thread into the same analysis pipeline
- [ ] Billing, quotas, and abuse monitoring
- [ ] Target repo config: point the app at any git repo (not just itself)

## Hardening (ongoing, not a phase)

These happen whenever they're needed, not in sequence.

- [ ] MongoDB adapter for sessions (revocation / multi-device)
- [ ] Stricter rate limiting (Redis or edge)
- [ ] E2E tests: sign-in mock + API ingest + process (mock LLM)
- [ ] `vinext deploy` + Wrangler docs
- [ ] Request logging without PII/secret leakage

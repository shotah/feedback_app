# TODO — feedback_app

## Phase 0 — POC (this repo)

- [x] vinext + App Router scaffold (`npm run dev` / `build` / `start`)
- [x] Google OAuth via Auth.js v5
- [x] MongoDB + Mongoose feedback model (`userId`, `title`, `kind`, `text`, context fields, `status`, `aiOutput`, `source`)
- [x] `POST/GET /api/feedback` (session + optional Bearer ingest key)
- [x] `POST /api/feedback/:id/process` (OpenAI JSON + Zod validation + safety-biased system prompt)
- [x] Docker Compose: `web` + `mongo:7`
- [x] README + `.env.example`

**POC “done” when:** `docker compose up --build` works with real Google + OpenAI keys, feedback appears in Mongo, and `aiOutput` is populated after process.

## Phase 0 — stretch (still POC)

Small upgrades that stay in this repo and support the **owner / manager / idea person** story (one ticket per message, feature work vs live bugs) without requiring Redis, CI agents, or multi-tenant billing.

- [x] **Intent on each message**: `kind: "feature" | "bug" | "other"` (schema + UI selector + LLM user message via `buildFeedbackUserMessage`).
- [x] **Lightweight context for “I’m using the app”**: `contextWhere`, `contextPage`, `contextSteps` on the doc, optional UI block, passed into the model.
- [x] **Human title**: optional `title` on create + `PATCH /api/feedback/:id` to edit; scannable list row.
- [x] **README examples**: copy-paste feature vs bug prompts in README.
- [x] **Health check**: `GET /api/health` and `GET /api/health?mongo=1`.
- [x] **Friendlier startup**: feedback/process routes return **503** + `{ missing }` when required env is absent (`lib/env.ts`).
- [x] **Operator UX**: collapsible “Raw / copy for agent” with full JSON payload + **Copy JSON** (includes `aiOutput` and `aiRaw`).
- [x] **Re-run semantics**: **Re-analyze (overwrites)** on `done` / `error` / `pending`; prior `aiOutput` cleared when re-running from `done`.
- [x] **Tiny test slice**: Vitest tests for `safeParseLlmFeedbackJson`, `rateLimit`, `buildFeedbackUserMessage` (`npm test`).
- [x] **Compose ergonomics**: `Makefile` + `npm run docker:*` + README.

## Phase 1 — Hardening

- [ ] MongoDB adapter (or DB-backed sessions) if you need revocation / multi-device audit
- [ ] Stricter rate limiting (Redis or edge) and request logging without PII/secret leakage
- [ ] E2E test: sign-in mock + API ingest + process (mock OpenAI)
- [ ] `vinext deploy` + Wrangler: document `AUTH_URL`, secrets, and Mongo reachable from Workers (or tunnel / Atlas allowlist)

## Phase 2 — GitHub / agent execution (out of POC)

- [ ] Create GitHub Issues from feedback (App or PAT with least privilege)
- [ ] Sandboxed job runner (CI or worker) that applies patches from structured `aiOutput` / human-approved plans
- [ ] Branch + PR flow; block merges without review for production repos
- [ ] Prompt/versioning and “human gate” for destructive operations

## Phase 3 — Product wrapper

- [ ] Multi-tenant “no-code” shell: per-user apps, keys, and feedback namespaces
- [ ] Per-user BYOK: UI to choose `LLM_PROVIDER`, model id, and store an encrypted API key; thread into `analyzeFeedbackText` (same Zod output contract)
- [ ] Billing, quotas, and abuse monitoring

# CLAUDE.md - Kaufmann AI

<!-- UPDATED: 2026-07-19 -->

## Project Overview

**Name**: `kauf-ai`
**Purpose**: Clinical intelligence dashboard ("Kaufmann AI" / KAUAI) used daily by Instituto Kaufmann (Dr. Oskar Kaufmann, integrative medicine, Brazil). Doctors fill in patient data (anamnese, labs, bioimpedância, genética, wearables), and the app generates a clinical analysis, a 9-module treatment plan (conduta), and prescriptions via the Anthropic API — plus patient management, consulta history, and print/PDF export.
**Status**: In production on Vercel (auto-deploys from `main` on GitHub).

---

## Tech Stack

| Layer       | Technology                                        |
|-------------|---------------------------------------------------|
| Framework   | Next.js 16.1 (App Router)                          |
| UI          | React 19, TypeScript                               |
| Styling     | Tailwind CSS v4, PostCSS                           |
| AI          | `@anthropic-ai/sdk`, model `claude-sonnet-4-5-20250929` |
| Database    | Neon serverless Postgres (`@neondatabase/serverless`) |
| PDF (server)| `pdf-parse` (text extraction, Vision fallback)     |
| PDF (client)| `pdfjs-dist` (large-file text extraction + page OCR) |
| Tests       | Vitest (`npm test`)                                |

---

## Quick Start

```bash
npm install
npm run dev    # http://localhost:3000
npm test       # vitest run
```

Env vars (`.env.local`): `ANTHROPIC_API_KEY`, `DATABASE_URL`, `CLINIC_PIN` (required — auth fails closed without it), optional `ADMIN_KEY`, `KAUF_BRIDGE_SECRET` (CRM webhook).

---

## Auth

All API routes require the `X-Clinic-Pin` header, verified server-side by [auth.ts](app/lib/auth.ts) (`verifyClinicPin` — fail-closed, timing-safe). The PIN is entered at login ([PinLogin.tsx](app/components/PinLogin.tsx)), stored in `localStorage("kai-clinic-pin")`, and attached by `getHeaders()`/`getPinHeaders()` in [api-client.ts](app/lib/api-client.ts). Login attempts are rate-limited (8 per 15 min).

---

## AI Pipeline

- [anthropic.ts](app/lib/anthropic.ts) — shared SDK client (`getAnthropicClient`), `cachedSystem()` (prompt-cache system blocks), `streamToSSE()` (re-encodes SDK stream as `data: {"text"}` SSE; emits `data: {"error"}` on `max_tokens`/`refusal` stop reasons), `messageText()` (extracts text block, skipping thinking blocks).
- [prompts.ts](app/lib/prompts.ts) — the generation builders (analise, conduta, receita) return a single user-message string: the June 2026 production prompts, restored verbatim at the clinic's request (plus the approved 30-day diet/training additions in the conduta). Do NOT restructure them into system/user or "improve" their wording without the doctor's sign-off — output quality regressed the last time this was done. The chat and patient-pdf builders still return `{ system, user }` for prompt caching.
- Streaming routes (`generate-analise`, `generate-conduta`, `generate-prescription`) use `client.messages.stream(..., { signal: req.signal })` so client aborts cancel the upstream call, with `max_tokens: 8192`, `temperature: 0.3`, no system block, no thinking — the June production configuration. AI routes set `maxDuration = 300` (clamped to 60s on the free Vercel plan).
- Client-side, [stream.ts](app/utils/stream.ts) `processStream()` accumulates chunks and **throws** if the server emitted an error event (truncation/refusal) — hooks surface it as a toast while keeping partial text visible. It also handles optional `{"thinking"}` preview chunks; Sonnet 4.5 never emits them, so the preview UI simply stays hidden.
- Model migration warning: `claude-sonnet-5` was tried in July 2026 and rolled back — its always-on adaptive thinking consumed the token budget/time limit on large inputs (silent empty outputs) and it rejects `temperature`. Do not re-upgrade the model without testing against a 60+ page exam input on the production Vercel plan.

### Phase System (Engine)

The production engine is client-side: [useEngineStatus.ts](app/hooks/useEngineStatus.ts) classifies Phase A/B/C from wearable metrics vs settings thresholds and produces `waiting: [{module, criteria}]`. The engine panel and the KAUAI chat still receive that status, but since the June-prompt restore the generation prompts no longer inject phase blocking rules or doctor-correction few-shot examples (the frontend still sends `corrections`/`phaseContext` in request bodies; the routes ignore them). `formatPhaseContext()`/`formatCorrections()` remain in prompts.ts, currently unused by any builder.

---

## File Map

### Core (`app/lib/`)

| File | Purpose |
|------|---------|
| [anthropic.ts](app/lib/anthropic.ts) | Shared Anthropic SDK client + SSE helpers |
| [prompts.ts](app/lib/prompts.ts) | All prompt builders (`{system, user}` shape) |
| [auth.ts](app/lib/auth.ts) | Fail-closed PIN auth + rate limiting |
| [db.ts](app/lib/db.ts) | Neon Postgres: patients, consultas, audit, corrections tables |
| [api-client.ts](app/lib/api-client.ts) | Client-side API wrapper with localStorage fallback |
| [corrections.ts](app/lib/corrections.ts) | Doctor-correction store (localStorage) for AI few-shot learning |
| [extraction.ts](app/lib/extraction.ts) | Regex extraction of demographics/labs from text |
| [audit.ts](app/lib/audit.ts) | Client-side audit log (localStorage) |
| [crm.ts](app/lib/crm.ts) | Outbound CRM notifications |
| [clientPdf.ts](app/lib/clientPdf.ts) | Browser-side pdf.js text extraction / page render / image compression |
| [condense.ts](app/lib/condense.ts) | Invisible pre-generation step: input fields >15k chars are condensed via `/api/condense-exam` (Haiku) with in-memory caching; the doctor's input boxes are never modified |

### API Routes (`app/api/`)

| Endpoint | Description |
|----------|-------------|
| `/api/generate-analise` | Streamed clinical analysis (SSE) |
| `/api/generate-conduta` | Streamed 9-module treatment plan (SSE) |
| `/api/generate-prescription` | Streamed receituário extraction from conduta (SSE) |
| `/api/generate-patient-pdf` | Patient-friendly plan (non-streaming) |
| `/api/chat-assistant` | KAUAI copilot; replies may embed multiple `:::COMMAND:::` JSON blocks (`edit` find/replace, `append`, `set`) targeting analise/conduta/receita |
| `/api/import-pdf` | PDF/image OCR (pdf-parse fast path → Claude Vision fallback) |
| `/api/condense-exam` | Haiku extraction pass: distills oversized exam text into a structured summary before generation (called invisibly by [condense.ts](app/lib/condense.ts); falls back to raw text on failure) |
| `/api/patients`, `/api/patients/[id]`, `/api/patients/[id]/consultas`, `/api/consultas` | Patient/consulta CRUD (Neon) |
| `/api/verify-pin` | PIN login (rate-limited) |
| `/api/db/init` | Schema init (admin key or PIN) |
| `/api/webhooks/crm` | Inbound CRM patient upsert (Bearer `KAUF_BRIDGE_SECRET`) |

### Frontend

- [page.tsx](app/page.tsx) — dashboard orchestrator: patient sidebar (left), inputs + outputs (center), KAUAI chat + engine panel (right). State lives here, fanned out to hooks.
- Hooks (`app/hooks/`): `useSessionPersistence` (debounced autosave → localStorage + DB, flush on tab close), `usePatientManagement` (switch/create/trash), `useGenerationWorkflow` (run/stop per output), `useFileImport` (multi-file import; client-side big-PDF handling), `useCopilotChat`, `useCorrectionCapture`, `useEngineStatus`, `useExportHandlers` (print via `window.print()`).

---

## Style Constraints (prompts)

- Objective, clinical language; no emojis, no metaphors
- Generated text must be markdown-free (`NO_MARKDOWN_RULES` in prompts.ts)
- Blocked/waiting modules must render as "AGUARDANDO: [critério]" in the conduta

## Development Notes

- PDFs >4MB never reach the server: digital PDFs are text-extracted in the browser; scanned ones are rendered to JPEGs client-side and OCR'd page by page ([clientPdf.ts](app/lib/clientPdf.ts), [useFileImport.ts](app/hooks/useFileImport.ts))
- Print/export uses native `window.print()` with `no-print`/`print:` classes; print headers use `/public/ik-logo.png` (+ `-white` variant for dark mode in-app)
- Deploy: push to `main` → GitHub → Vercel auto-deploy. The Vercel project is **kauf-ai-lucas** (`prj_g1IoLS6LeFQajKVV9te0BZUyyTKS`, domain kai-oskar.vercel.app). Its Git integration pointed at the wrong repo (`kauf-ai-pdf-debug`) until 2026-07-20 — every deploy before then was a manual `vercel` CLI upload — but it now points at `kauf-ai-v2` and push-to-deploy is verified working. The Vercel CLI is logged in on this machine and the folder is linked (`.vercel/`), but prefer `git push` over `vercel --prod` so the repo and production never drift.

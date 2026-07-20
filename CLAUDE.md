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
| AI          | `@anthropic-ai/sdk`, model `claude-sonnet-4-6`     |
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
- [prompts.ts](app/lib/prompts.ts) — every builder returns `{ system, user }`: static template in `system` (cacheable), per-patient data in `user`. Do not interpolate dynamic values into the system text.
- Streaming routes (`generate-analise`, `generate-conduta`, `generate-prescription`) use `client.messages.stream(..., { signal: req.signal })` so client aborts cancel the upstream call. All AI routes set `maxDuration = 60`.
- Client-side, [stream.ts](app/utils/stream.ts) `processStream()` accumulates chunks and **throws** if the server emitted an error event (truncation/refusal) — hooks surface it as a toast while keeping partial text visible.
- Sonnet 5 notes: `temperature` is rejected; adaptive thinking is on by default (responses may begin with a `thinking` block — always use `messageText()`/find the text block, never `content[0]`).

### Phase System (Engine)

The production engine is client-side: [useEngineStatus.ts](app/hooks/useEngineStatus.ts) classifies Phase A/B/C from wearable metrics vs settings thresholds and produces `waiting: [{module, criteria}]`. That `phaseContext` is sent with generation requests, and `formatPhaseContext()` injects blocking rules ("AGUARDANDO: ...") into the conduta prompt. Enforcement is prompt-side.

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

### API Routes (`app/api/`)

| Endpoint | Description |
|----------|-------------|
| `/api/generate-analise` | Streamed clinical analysis (SSE) |
| `/api/generate-conduta` | Streamed 9-module treatment plan (SSE) |
| `/api/generate-prescription` | Streamed receituário extraction from conduta (SSE) |
| `/api/generate-patient-pdf` | Patient-friendly plan (non-streaming) |
| `/api/chat-assistant` | KAUAI copilot; replies may embed multiple `:::COMMAND:::` JSON blocks (`edit` find/replace, `append`, `set`) targeting analise/conduta/receita |
| `/api/import-pdf` | PDF/image OCR (pdf-parse fast path → Claude Vision fallback) |
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

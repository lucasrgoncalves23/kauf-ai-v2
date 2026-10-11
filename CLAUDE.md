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

The production engine is client-side: [useEngineStatus.ts](app/hooks/useEngineStatus.ts) classifies Phase A/B/C from wearable metrics vs settings thresholds and produces `waiting: [{module, criteria}]`. The engine panel and the KAUAI chat still receive that status, but since the June-prompt restore the generation prompts no longer inject phase blocking rules (the frontend still sends `phaseContext` in request bodies; the routes ignore it). `formatPhaseContext()` remains in prompts.ts, currently unused by any builder. The old "IA Learning" doctor-correction feature was removed in October 2026 (it had been disconnected from the prompts since the June restore); the `corrections` table still exists in Postgres but nothing reads or writes it.

---

## File Map

### Core (`app/lib/`)

| File | Purpose |
|------|---------|
| [anthropic.ts](app/lib/anthropic.ts) | Shared Anthropic SDK client + SSE helpers |
| [prompts.ts](app/lib/prompts.ts) | All prompt builders (`{system, user}` shape) |
| [auth.ts](app/lib/auth.ts) | Fail-closed PIN auth + rate limiting |
| [db.ts](app/lib/db.ts) | Neon Postgres: patients, consultas, audit tables |
| [api-client.ts](app/lib/api-client.ts) | Client-side API wrapper with localStorage fallback |
| [extraction.ts](app/lib/extraction.ts) | Regex extraction of demographics/labs from text |
| [audit.ts](app/lib/audit.ts) | Client-side audit log (localStorage) |
| [crm.ts](app/lib/crm.ts) | Outbound CRM notifications |
| [whatsapp.ts](app/lib/whatsapp.ts) | Meta Cloud API client (send template/text/document, webhook verification, payload parsing) |
| [whatsappTemplates.ts](app/lib/whatsappTemplates.ts) | Approved template registry + parameter builders |
| [whatsappNotify.ts](app/lib/whatsappNotify.ts) | Best-effort notification triggers (consulta, documento, lembrete, retorno, anamnese) |
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
| `/api/webhooks/whatsapp` | Meta Cloud API webhook (GET verification + POST inbound messages/status) |
| `/api/whatsapp/send` | Send template, freeform text, or document to a patient (PIN auth + LGPD check) |
| `/api/whatsapp/messages` | GET conversation history for a patient |
| `/api/whatsapp/opt-in` | POST consent / DELETE revoke / GET status (LGPD) |

### Frontend

- [page.tsx](app/page.tsx) — dashboard orchestrator: patient sidebar (left), inputs + outputs (center), KAUAI chat + engine panel (right). State lives here, fanned out to hooks.
- Hooks (`app/hooks/`): `useSessionPersistence` (debounced autosave → localStorage + DB, flush on tab close), `usePatientManagement` (switch/create/trash), `useGenerationWorkflow` (run/stop per output), `useFileImport` (multi-file import; client-side big-PDF handling), `useCopilotChat`, `useEditAudit` (logs significant doctor edits of AI output to the audit trail), `useEngineStatus`, `useExportHandlers` (print via `window.print()`).

---

## WhatsApp CRM (Direct Integration)

Direct Meta Cloud API integration for patient messaging. Env vars: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_BUSINESS_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`. All optional — when unconfigured, WhatsApp features are silently disabled (same pattern as the CRM bridge).

### Message Flow
- **Outbound templates** (outside 24h window): consulta_resumo, lembrete_consulta, retorno_fase, formulario_anamnese, documento_disponivel. Defined in [whatsappTemplates.ts](app/lib/whatsappTemplates.ts); must match approved templates in Meta Business Manager.
- **Freeform text/documents** (within 24h window): doctor can reply directly via the send endpoint. The 24h window opens when a patient sends any inbound message.
- **Inbound**: patient replies (text, buttons, interactive) are stored in `wa_messages` and linked to patients by phone. Button payloads (CONFIRM_APPOINTMENT, RESCHEDULE_APPOINTMENT, SCHEDULE_RETURN) are logged for future automation.

### Auto-triggers
- Consulta saved → sends `consulta_resumo` template (wired in [patients/[id]/consultas/route.ts](app/api/patients/[id]/consultas/route.ts) alongside CRM notify)
- Document exported → sends `documento_disponivel` (via `notifyWhatsAppDocumentoExportado`)
- All triggers check LGPD opt-in before sending; fail silently if unconsented.

### DB Tables
- `wa_messages` — every sent/received message with delivery status tracking
- `wa_conversations` — active 24h session windows per phone
- `wa_opt_in` — LGPD consent records (patient_id, consented_at, revoked_at, method)

### LGPD Compliance
Patients must be opted in via `/api/whatsapp/opt-in` before any automated message is sent. Opt-out stops all messaging. The "SAIR" keyword in inbound messages should trigger auto-revocation (TODO: implement in webhook handler).

---

## Patient Portal (`/portal`)

Read-only, plain-language version of a consultation that the patient opens on their phone via a personal link. Isolated from the doctor app: nothing under `app/portal/**` or `app/api/portal/open` uses the clinic PIN, and the portal reads only from the `portal_publications` snapshot table, never from live `patients`/`consultas`.

- **Link**: `https://<host>/portal#<token>` — the token lives in the URL fragment so it never reaches server logs. 32 random bytes, stored only as an HMAC (`token_hash`) plus AES-GCM-encrypted (`token_enc`) so the doctor can re-copy it. Re-openable until `expires_at` (90 days); CPF required on every open.
- **Access** (`POST /api/portal/open {token, cpf}`): CPF compared as HMAC; wrong CPF → generic 401 and `failed_attempts++` with a lockout ladder (5 → 15 min, 10 → 24 h, 20 → permanent `locked`); expired/revoked/superseded/locked → 410 with a specific message. Trashed patients are treated as not found. Every open/failed attempt is written to `portal_access_log` (IP as HMAC). The page keeps the payload in memory only — reload re-prompts the CPF.
- **Publishing** (doctor, PIN): `POST /api/portal/preview {patientId, consultaId}` rebuilds everything from the saved consulta, calls the model with a forced tool (`buildPortalContentPrompt` in prompts.ts → `portalContentSchema` in [schema.ts](app/lib/portal/schema.ts)) and validates: zod shape (minor shape slips are normalized first), any dose-like mention in the AI text must appear verbatim in the receita/conduta (`unverifiedDoseMentions`), explanations for markers without results are dropped, `checkClinicalRules` on sources and on the AI text. A receita is required: the medication list (names, doses, times) comes only from the receita's `CRONOGRAMA DIÁRIO` or its numbered items (deterministic, [extract.ts](app/lib/portal/extract.ts)); the AI never writes doses and only adds a per-item note. Diet/training 30-day blocks and the full receita are shown verbatim. `POST /api/portal/publish` re-validates and stores the snapshot (one active publication per patient; previous ones become `superseded`). Also `GET /api/portal/publications?patientId=`, `POST .../[id]/revoke` (erases the payload), `POST .../[id]/reissue` (new token, same content).
- **Doctor UI**: [PatientPortalCard.tsx](app/components/PatientPortalCard.tsx) (sidebar; status, copy link, QR, new link, revoke) and [PublishPortalModal.tsx](app/components/PublishPortalModal.tsx) (prechecks → generate → phone-sized iframe preview of `/portal?preview=1` fed via `postMessage` → link + QR). Publishing requires the consulta to be saved with the on-screen texts.
- **Env**: `PORTAL_SECRET` (≥32 chars; keys derived with HKDF — publishing and opening fail closed without it) and `CLINIC_CONTACT_LINE` (LGPD controller contact shown to patients; required to publish). Tables are created lazily by `ensurePortalTables()` and by `POST /api/db/init`.
- Security headers for `/portal` and `/api/portal/*` live in [next.config.ts](next.config.ts); `app/robots.ts` disallows `/portal` and `/api/`.

## Style Constraints (prompts)

- Objective, clinical language; no emojis, no metaphors
- Generated text must be markdown-free (`NO_MARKDOWN_RULES` in prompts.ts)
- Blocked/waiting modules must render as "AGUARDANDO: [critério]" in the conduta

## Development Notes

- PDFs >4MB never reach the server: digital PDFs are text-extracted in the browser; scanned ones are rendered to JPEGs client-side and OCR'd page by page ([clientPdf.ts](app/lib/clientPdf.ts), [useFileImport.ts](app/hooks/useFileImport.ts))
- Print/export uses native `window.print()` with `no-print`/`print:` classes; print headers use `/public/ik-logo.png` (+ `-white` variant for dark mode in-app)
- Deploy: push to `main` → GitHub → Vercel auto-deploy. The Vercel project is **kauf-ai-lucas** (`prj_g1IoLS6LeFQajKVV9te0BZUyyTKS`, domain kai-oskar.vercel.app). Its Git integration pointed at the wrong repo (`kauf-ai-pdf-debug`) until 2026-07-20 — every deploy before then was a manual `vercel` CLI upload — but it now points at `kauf-ai-v2` and push-to-deploy is verified working. The Vercel CLI is logged in on this machine and the folder is linked (`.vercel/`), but prefer `git push` over `vercel --prod` so the repo and production never drift.

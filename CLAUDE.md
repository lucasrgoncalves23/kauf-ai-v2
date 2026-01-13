# CLAUDE.md - Kauf AI Debug

<!-- UPDATED: 2026-01-13 -->

## Project Overview

**Name**: `kauf-ai-pdf-debug`
**Purpose**: Clinical intelligence dashboard ("Kaufmann AI") for integrative health analysis. Processes patient data, classifies physiological "Phases", and suggests clinical priorities with module blocking logic.
**Status**: Debug/test environment for the decision engine and PDF import.

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Framework   | Next.js 16.1 (App Router)           |
| UI          | React 19, TypeScript                |
| Styling     | Tailwind CSS v4, PostCSS            |
| PDF Parsing | `pdf-parse` (text extraction)       |
| Lint        | ESLint v9                           |

---

## Quick Start

```bash
npm install
npm run dev    # http://localhost:3000
```

---

## Architecture: Kaufmann Engine

### Phase System

The engine classifies patients into metabolic readiness phases ([engine.ts:23-34](app/lib/engine.ts#L23-L34)):

| Phase | Name    | Description                              | Blocked Modules                      |
|-------|---------|------------------------------------------|--------------------------------------|
| A     | Recover | Autonomic instability (HRV↓, RHR↑)       | Hormonal, Peptídeos, Metabolismo/GLP-1 |
| B     | Build   | Conservative/default state               | Peptídeos                            |
| C     | Peak    | Optimization mode                        | None                                 |

### Phase Decision Logic

```typescript
// Simplified from engine.ts
if (hrvTrend === "down" && rhrTrend === "up") → Phase A
else → Phase B (conservative default)
```

### Therapeutic Programs

Defined in [kaufmannSpec.ts:13-23](app/lib/kaufmannSpec.ts#L13-L23):
- Sono, Nutrição, Exercício, Suplementação
- Manipulados, Soroterapia
- Metabolismo/GLP-1, Hormonal, Peptídeos (conditionally blocked)

---

## File Map

### Core Logic (`app/lib/`)

| File | Purpose |
|------|---------|
| [engine.ts](app/lib/engine.ts) | `runEngine()` - main decision logic, `decidePhase()` |
| [kaufmannSpec.ts](app/lib/kaufmannSpec.ts) | Constants: `PHASE_RULES`, `PROGRAM_BLOCKS`, `KPI_TEMPLATE` |

### Types (`app/types/`)

| File | Exports |
|------|---------|
| [clinical.ts](app/types/clinical.ts) | `Phase`, `ClinicalInput`, `AnamneseBase`, `WearableSnapshot`, `Labs` |

### API Routes (`app/api/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| [/api/import-pdf](app/api/import-pdf/route.ts) | POST | FormData → `pdf-parse` → extracted text JSON |
| [/api/generate-report](app/api/generate-report/route.ts) | — | Report generation (if implemented) |

### Frontend (`app/`)

| File | Purpose |
|------|---------|
| [page.tsx](app/page.tsx) | Main dashboard: patient snapshot (left), report editor (center), engine state (right) |
| [globals.css](app/globals.css) | Tailwind v4 config |

---

## Key Types

```typescript
// ClinicalInput - main engine input
type ClinicalInput = {
  phaseAssumption?: Phase;        // Override phase
  base: AnamneseBase;             // chiefComplaint required
  wearable?: WearableSnapshot;    // hrvTrend, rhrTrend
  labs?: Labs;                    // homaIr, hba1c, glucose, insulin
};

// EngineDecision - output
type EngineDecision = {
  phase: Phase;
  blocked: { module: BlockedModule; reason: string }[];
  alerts: string[];
};
```

---

## Data Flow

```
PDF Upload → /api/import-pdf → Text Extraction
                    ↓
            Clinical Input → runEngine() → EngineDecision + GeneratedReport
                    ↓
            Dashboard renders: Dx, Gargalo, Camadas, Programas, KPIs
```

---

## Style Constraints

From [kaufmannSpec.ts:81-87](app/lib/kaufmannSpec.ts#L81-L87):
- Objective, clinical language
- No emojis, no metaphors
- Short, affirmative sentences
- Never suggest blocked modules
- Always justify blocks in Engine State

---

## Development Notes

- PDF parsing uses `pdf-parse/lib/pdf-parse.js` directly (not demo entry)
- Print/export uses native `window.print()` with CSS `no-print` classes
- Engine state displays blocked modules with reasons in right sidebar
- Phase can be manually overridden via `phaseAssumption` in input

# GEMINI.md - Kauf AI Debug Context

<!-- UPDATED: 2026-01-13 -->
<!-- CONTEXT: Repository Map & Architecture for Kauf AI -->

---

## 🚀 Identidade do Projeto

**Nome**: `kauf-ai-pdf-debug`
**Objetivo**: Dashboard de inteligência clínica ("Kaufmann AI") para análise de saúde integrativa. Processa dados de pacientes, define "Fases" fisiológicas e sugere prioridades clínicas. Este repo parece ser um ambiente de debug/teste para o motor de decisão e importação de PDF.

---

## 🛠 Tech Stack

| Camada      | Tecnologia                                      |
| ----------- | ----------------------------------------------- |
| **Core**    | Next.js 16.1 (App Router), React 19, TypeScript |
| **Estilo**  | Tailwind CSS v4, PostCSS                        |
| **Backend** | Next.js API Routes                              |
| **Parsing** | `pdf-parse` (extração de texto de PDF)          |
| **Lint**    | ESLint v9                                       |

---

## 🧠 Arquitetura: The Kaufmann Engine

O coração do sistema é o "Engine" determinístico que dita a conduta clínica com base em biomarcadores.

### 1. Conceito de "Fases"

O sistema classifica o paciente em fases de prontidão metabólica (definido em `app/lib/engine.ts` e `kaufmannSpec.ts`):

- **Fase A (Recover)**: Instabilidade autonômica (ex: HRV ↓, RHR ↑). Bloqueia estratégias avançadas.
- **Fase B (Build)**: Estado conservador/padrão.
- **Fase C (Peak)**: (Implícito) Otimização.

### 2. Módulos & Bloqueios

Certos programas terapêuticos são bloqueados dependendo da Fase:

- **Módulos Críticos**: Hormonal, Peptídeos, Metabolismo/GLP-1.
- **Lógica**: Se o paciente está inflamado/estressado (Fase A), módulos avançados são travados ("BlockedModule") para evitar dano.

### 3. Fluxo de Dados

1. **Input**: Upload de PDF Exames/Wearables (via `app/api/import-pdf`).
2. **Parsing**: Extração de texto bruto.
3. **Engine**: `runEngine(clinicalInput)` processa dados.
4. **Output**: Gera relatório com:
   - Diagnóstico Integrativo
   - Gargalo Primário
   - Kpis de 30/60/90 dias

---

## 📂 Mapa de Arquivos Importantes

### Core Logic (`app/lib/`)

- `engine.ts`: A lógica de decisão. Contém:
  - `decidePhase()`: Algoritmo de classificação de fase.
  - `runEngine()`: Gera o report final e alertas.
- `kaufmannSpec.ts`: Contém as constantes (`PROGRAMS`), regras de fase (`PHASE_RULES`) e templates.

### Frontend (`app/`)

- `page.tsx`: Dashboard "Single Page".
  - **Esquerda**: Snapshot do paciente (Idade, Peso, Risco).
  - **Centro**: Editor de Report (Diagnóstico, Programas).
  - **Direita**: Alertas do Sistema e Status do Engine (Modules Blocked).
- `globals.css`: Configuração global do Tailwind v4.

### Backend (`app/api/`)

- `import-pdf/route.ts`: Endpoint POST. Recebe `FormData` com PDF, usa `pdf-parse` e retorna texto bruto/JSON.

---

## ⚡ Quick Start

1. **Install**: `npm install`
2. **Dev**: `npm run dev` (Porta 3000)
3. **Uso**: Carregar PDF -> Ver engine calcular fase -> Editar condutas sugeridas.

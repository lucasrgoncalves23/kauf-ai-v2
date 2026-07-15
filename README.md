# Kauf AI - Clinical Intelligence Dashboard

Dashboard de inteligência clínica para análise integrativa de saúde. Processa dados de pacientes, classifica "Fases" fisiológicas e sugere prioridades clínicas com lógica de bloqueio de módulos.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Quick Start](#quick-start)
- [Arquitetura](#arquitetura)
- [Funcionalidades](#funcionalidades)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [API Reference](#api-reference)
- [Configuração](#configuração)
- [Tech Stack](#tech-stack)

---

## Visão Geral

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           KAUF AI DASHBOARD                              │
├──────────────────┬────────────────────────────┬─────────────────────────┤
│  PATIENT         │     CLINICAL REPORT        │    SYSTEM STATUS        │
│  SNAPSHOT        │                            │                         │
│                  │  ┌────────────────────┐    │  ┌─────────────────┐    │
│  Age: 47         │  │ Diagnóstico        │    │  │ API Config      │    │
│  Sex: M          │  │ Integrativo        │    │  │ ● Configurada   │    │
│  Height: 178cm   │  └────────────────────┘    │  └─────────────────┘    │
│  Weight: 91kg    │                            │                         │
│                  │  ┌────────────────────┐    │  ┌─────────────────┐    │
│  Objective:      │  │ Gargalo Primário   │    │  │ System Alerts   │    │
│  Fat loss +      │  └────────────────────┘    │  │ ● No alerts     │    │
│  energy          │                            │  └─────────────────┘    │
│                  │  ┌────────────────────┐    │                         │
│  DATA STATUS     │  │ Programas          │    │  ┌─────────────────┐    │
│  ✓ Labs          │  │ ▶ Sono             │    │  │ Engine State    │    │
│  ✓ Bioimpedance  │  │ ▶ Nutrição         │    │  │ Phase: B        │    │
│  ! Wearable      │  │ ▶ Exercício        │    │  └─────────────────┘    │
│  — Genetics      │  │ ▶ ...              │    │                         │
│                  │  └────────────────────┘    │                         │
└──────────────────┴────────────────────────────┴─────────────────────────┘
```

---

## Quick Start

### Pré-requisitos

- Node.js 18+
- npm ou yarn

### Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/kauf-ai-pdf-debug.git
cd kauf-ai-pdf-debug

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

### Acesse

Abra [http://localhost:3000](http://localhost:3000) no navegador.

---

## Arquitetura

### Sistema de Fases (Kaufmann Engine)

O engine classifica pacientes em fases de prontidão metabólica:

| Fase | Nome    | Descrição                              | Módulos Bloqueados               |
|------|---------|----------------------------------------|----------------------------------|
| A    | Recover | Instabilidade autonômica (HRV↓, RHR↑)  | Hormonal, Peptídeos, GLP-1       |
| B    | Build   | Estado conservador/padrão              | Peptídeos                        |
| C    | Peak    | Modo de otimização                     | Nenhum                           |

### Lógica de Decisão

```typescript
if (hrvTrend === "down" && rhrTrend === "up") → Fase A (Recover)
else → Fase B (Build - conservador)
```

### Fluxo de Dados

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│  PDF Upload │───▶│ /api/import  │───▶│ Text Extraction │
└─────────────┘    └──────────────┘    └────────┬────────┘
                                                 │
                                                 ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Dashboard  │◀───│   Engine     │◀───│ Clinical Input  │
│   Render    │    │  Decision    │    │   Processing    │
└─────────────┘    └──────────────┘    └─────────────────┘
```

---

## Funcionalidades

### 1. Importação de PDF

- Upload de arquivos PDF via interface
- Extração automática de texto usando `pdf-parse`
- Feedback visual com toast notifications
- Exibição de metadados (páginas, caracteres)

### 2. Relatório Clínico

Seções editáveis:
- **Diagnóstico Integrativo** - Análise geral do paciente
- **Gargalo Primário** - Principal limitação identificada
- **Camadas Ativas** - Níveis de intervenção ativos
- **Programas** - 9 programas terapêuticos expansíveis
- **KPIs** - Metas para 30/60/90 dias

### 3. Programas Terapêuticos

| Programa           | Descrição                          |
|--------------------|------------------------------------|
| Sono               | Otimização do ciclo circadiano     |
| Nutrição           | Plano alimentar personalizado      |
| Exercício          | Protocolo de atividade física      |
| Suplementação      | Suplementos baseados em evidências |
| Manipulados        | Fórmulas farmacêuticas             |
| Soroterapia        | Terapia intravenosa                |
| Metabolismo/GLP-1  | Modulação metabólica*              |
| Hormonal           | Reposição hormonal*                |
| Peptídeos          | Terapia peptídica*                 |

*Podem ser bloqueados dependendo da Fase do paciente

### 4. Configuração de API

- Armazenamento seguro de API key em localStorage
- Indicador visual de status (configurada/não configurada)
- Opção de visualizar/ocultar a chave
- Validação de formato

### 5. Export PDF

- Exportação via `window.print()`
- Classes CSS `no-print` ocultam elementos de UI
- Layout otimizado para impressão

---

## Estrutura do Projeto

```
kauf-ai-pdf-debug/
├── app/
│   ├── api/
│   │   ├── import-pdf/
│   │   │   └── route.ts      # POST: Extração de texto de PDF
│   │   └── generate-report/
│   │       └── route.ts      # Geração de relatórios
│   ├── lib/
│   │   ├── engine.ts         # Lógica do Kaufmann Engine
│   │   └── kaufmannSpec.ts   # Constantes e regras de fase
│   ├── types/
│   │   └── clinical.ts       # Tipos TypeScript
│   ├── globals.css           # Estilos globais + Tailwind
│   ├── layout.tsx            # Layout principal
│   └── page.tsx              # Dashboard principal
├── public/                   # Assets estáticos
├── CLAUDE.md                 # Documentação para Claude AI
├── GEMINI.md                 # Documentação para Gemini AI
├── package.json
└── README.md
```

---

## API Reference

### POST /api/import-pdf

Extrai texto de um arquivo PDF.

**Request:**
```
Content-Type: multipart/form-data
Body: FormData com campo "file" (PDF)
```

**Response (sucesso):**
```json
{
  "ok": true,
  "filename": "documento.pdf",
  "bytes": 12345,
  "text": "Conteúdo extraído...",
  "numPages": 3
}
```

**Response (erro):**
```json
{
  "ok": false,
  "error": "Mensagem de erro"
}
```

---

## Configuração

### API Key

1. Na barra lateral direita, localize "API Configuration"
2. Insira sua API key no campo (formato: `sk-...`)
3. Clique em "Salvar"
4. O indicador mudará para verde ("API key configurada")

A chave é armazenada em `localStorage` e persiste entre sessões.

### Variáveis de Ambiente (opcional)

Crie um arquivo `.env.local` para configurações adicionais:

```env
# Exemplo de configurações futuras
NEXT_PUBLIC_API_URL=https://api.example.com
```

### Ponte com o CRM (Kaufmann Clinic OS)

Integração bidirecional com o CRM da clínica:

- **CRM → Kauf AI**: quando um paciente agenda consulta via WhatsApp ou é cadastrado no painel do CRM, ele aparece aqui automaticamente. Endpoint: `POST /api/webhooks/crm` (evento `paciente_upsert`), autenticado por `Authorization: Bearer <KAUF_BRIDGE_SECRET>`. O match usa `kauf_id` → CPF → telefone (`profile.phone`); responde `{ "kauf_id": "..." }`.
- **Kauf AI → CRM**: ao salvar uma consulta, o desfecho (conduta + notas) é enviado ao CRM ([app/lib/crm.ts](app/lib/crm.ts)), que extrai ações operacionais ("retorno semana que vem") como sugestões de tarefa pendentes de aprovação.

```env
# .env.local
KAUF_BRIDGE_SECRET=   # mesmo segredo configurado no CRM
CRM_WEBHOOK_URL=      # ex.: https://crm.exemplo.com/api/webhooks/kauf
```

> 💡 O telefone (WhatsApp) é a chave de identidade do CRM — colete-o no cadastro (`profile.phone`) para que o match entre os sistemas seja imediato.

---

## Tech Stack

| Camada      | Tecnologia                |
|-------------|---------------------------|
| Framework   | Next.js 16.1 (App Router) |
| UI          | React 19, TypeScript      |
| Styling     | Tailwind CSS v4           |
| PDF         | pdf-parse                 |
| Build       | Webpack (não Turbopack*)  |

*O pdf-parse tem incompatibilidade com Turbopack, por isso usamos Webpack.

---

## Scripts Disponíveis

```bash
npm run dev      # Servidor de desenvolvimento (webpack)
npm run build    # Build de produção
npm run start    # Servidor de produção
npm run lint     # Verificação de código
```

---

## Contribuição

1. Faça fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'feat: adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

---

## Licença

Este projeto é privado e de uso interno.

---

## Suporte

Para dúvidas ou problemas:
- Abra uma issue no repositório
- Contate a equipe de desenvolvimento

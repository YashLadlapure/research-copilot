# Research Copilot

A web app that checks research manuscripts against Springer LNCS and IEEE Conference formatting rules, then uses Gemini to safely refine individual sections without changing the technical meaning.

**Live demo → [research-copilot-eight.vercel.app](https://research-copilot-eight.vercel.app)**

---

## What it does

Paste or upload a manuscript, pick a target publication format, and get:

- A structured compliance report with issues grouped by severity
- Section-level detection: missing sections, weak abstract, bad citation style, caption format, acronym issues
- Gemini-powered refinement for any section, with a side-by-side diff before you accept
- Exportable checklist of what was flagged and what was fixed

It does not rewrite your paper. It does not change your claims. Every AI-assisted change is shown in a diff so you stay in control.

---

## Try it fast

1. Open the live demo
2. Paste any research abstract or upload a PDF
3. Select **Springer LNCS**
4. Click **Analyze manuscript**
5. Hit **Improve abstract** on any flagged issue to see Gemini refine it with a side-by-side diff

No account needed.

---

## How it works

```
Paste/upload manuscript
  → pick LNCS or IEEE
  → Gemini extracts structure (title, abstract, sections, keywords)
  → rule engine checks compliance against profile config
  → report with Critical / Review severity tags
  → click Refine on any section
  → Gemini returns revised_text + change_summary + confidence score
  → diff view → accept or discard
```

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite → Vercel |
| Backend | Node.js + Express → Render |
| AI | Gemini API (`gemini-2.5-flash-lite` with `gemini-3.1-flash-lite` as primary, configurable via `GEMINI_MODEL` env) |
| Storage | In-memory session store |

---

## Run locally

```bash
# Backend
cd backend
npm install
cp .env.example .env   # add your GEMINI_API_KEY
npm start

# Frontend
cd frontend
npm install
npm run dev
```

Frontend runs on `localhost:5173`, backend on `localhost:4000`.

---

## Project structure

```
research-copilot/
├── frontend/src/
│   ├── components/       # Upload, Report, DiffViewer, Refine panels
│   └── api.js            # all fetch calls to backend
└── backend/src/
    ├── ai/
    │   ├── geminiClient.js   # section extraction with retry
    │   └── geminiRefine.js   # safe section refinement
    ├── rules/
    │   └── evaluateCompliance.js   # deterministic rule engine
    ├── profiles/             # LNCS and IEEE config objects
    └── store.js              # session store
```

---

## Profiles

Two profiles are supported: **Springer LNCS** and **IEEE Conference**. Each defines required sections, abstract word limits, keyword count range, citation style, heading depth, and caption format rules. Switching profiles on the same manuscript produces different compliance issues.

---

Built for the [Build with Gemini](https://build-with-gemini-0.devpost.com/) hackathon.

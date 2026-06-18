# Saathi — Your Family's Health Memory

> Health data is scattered across WhatsApp chats, clinic folders, and siloed apps. Saathi unifies it into a single, shared intelligence layer for you and your family — so you're always prepared for the next appointment, report, or health moment.

Built for urban India's 25–35 demographic: wearable owners who manage health decisions for a parent or family member from afar, in a different city, often in a different language.

---

## What Saathi Does

**Reads your reports.** Upload a lab report (PDF or image) and Saathi extracts every metric, compares it against your history, and surfaces what changed.

**Tracks your numbers.** Wearable data — steps, sleep, resting heart rate — syncs automatically and is indexed alongside your lab history, not stored separately.

**Answers your questions.** Ask "Has my sleep improved since my last blood test?" and get a grounded answer from your own data. No hallucinations. No generic advice.

**Prepares you for appointments.** The Pre-Appointment Brief compiles your recent labs, wearable trends, and flagged changes into a one-page summary — shareable via WhatsApp to the patient or the doctor.

**Keeps context alive between visits.** The Weekly Digest surfaces patterns across your wearable and lab data, with one lifestyle nudge grounded in your actual numbers.

**Works for the whole family.** Add family members, upload their reports, and switch context with one tap. Each person's data stays separate. The caregiver sees the full picture.

---

## Phase 0 — Private Beta

The current version (`v0`) is a closed beta serving a small cohort of users. It is not publicly open for sign-ups.

**Live:**
- Frontend: https://saathi-v0.vercel.app
- Backend: https://saathi-v0-backend.vercel.app

---

## Core Features (v0)

| Feature | Status |
|---|---|
| Lab report upload + extraction (PDF/image) | ✅ Live |
| Fitbit wearable sync (daily + trends) | ✅ Live |
| RAG chat grounded in personal health data | ✅ Live |
| Pre-Appointment Brief generation | ✅ Live |
| Weekly Health Digest | ✅ Live |
| Family member management | ✅ Live |
| Multilingual support (Hindi) | 🔜 Phase 1 |
| WhatsApp document ingestion | 🔜 Phase 1 |
| Automated weekly digest (cron) | 🔜 Phase 1 |
| Family member invite + consent flow | 🔜 Phase 1 |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.12, Vercel serverless |
| Database | Supabase Postgres + pgvector |
| Storage | Supabase Storage |
| Auth | Supabase Auth (email + Google OAuth) |
| PDF Parsing | LlamaParse |
| Wearable | Fitbit API (Google Fit) |
| LLM | OpenRouter |
| Embeddings | OpenAI text-embedding-3-small |
| Tracing | LangSmith |

---

## Project Structure

```
saathi_phase0/
├── saathi/backend/          # FastAPI app + Vercel serverless entrypoint
│   ├── routers/             # ingest, rag, brief, digest, whatsapp
│   ├── services/            # report extraction, wearable sync, guardrails
│   └── db/                  # Supabase client + typed DB helpers
│
└── saathi-frontend/src/
    ├── app/
    │   ├── (app)/           # Authenticated routes — dashboard, chat, reports, brief, digest
    │   └── (public)/        # Unauthenticated routes — landing, login, onboarding
    ├── components/          # Sidebar, GlobalHeader, shared UI primitives
    └── lib/                 # API client, Supabase clients, session, member context
```

---

## Getting Started (Development)

### Prerequisites

- Node.js 20+
- Python 3.12+
- A Supabase project with pgvector enabled
- Fitbit developer app credentials
- OpenRouter API key
- LlamaParse API key

### Frontend

```bash
cd saathi-frontend
cp .env.local.example .env.local   # fill in your keys
npm install
npm run dev
```

Required env vars:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_BASE_URL=
NEXT_PUBLIC_API_URL=
FITBIT_CLIENT_ID=
FITBIT_CLIENT_SECRET=
SESSION_SECRET=
```

### Backend

```bash
cd saathi/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Required env vars:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
LLAMA_PARSE_API_KEY=
LANGSMITH_API_KEY=
FITBIT_CLIENT_ID=
FITBIT_CLIENT_SECRET=
```

### Database

Run the SQL schema in your Supabase SQL editor to create the required tables, RLS policies, and pgvector RPC functions. See `db/schema.sql` for the full setup.

---

## Privacy & Data Handling

- All health data is stored on Indian servers (AWS `ap-south-1`) to meet DPDP Act 2023 requirements.
- Health data is classified as sensitive personal data. Row-level security is enabled on all tables.
- The secondary user (family member) consents explicitly before any data is shared with the primary user.
- Lab reports are processed and then stored privately, scoped by user ID. Nothing is shared across accounts without explicit consent.

---

## Roadmap

**Phase 1 (Months 3–5)**
- WhatsApp inbound document ingestion (Meta Cloud API + OpenClaw skill)
- Hindi + regional language support (IndicTrans2)
- Sarvam AI voice input
- DPDP legal review + consent management layer
- Prescription parsing
- Automated weekly digest cron

**Phase 2 (Months 6–9)**
- Family plan + shared health graph
- Tamil, Telugu, Bengali language support
- Discharge summary + insurance document parsing
- Garmin integration
- Wearable onboarding CTA for non-owners

---

## Contributing

This is a private beta project. If you've been added as a collaborator, please open a PR against `main` with a clear description of what changed and why. Tag changes that touch the ingestion pipeline, guardrails, or member-scoping logic for extra review — these are the areas most likely to introduce data-correctness regressions.

---

*Saathi — Family health memory, built for India.*

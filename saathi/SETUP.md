# Saathi Phase 0 — Setup & Run

## 1. Supabase setup (5 minutes)
1. Create a project at supabase.com
2. Go to SQL editor → run `supabase/migrations/001_core_tables.sql`
3. Run `supabase/migrations/002_vector_functions.sql`
4. Go to Project Settings → API → copy `URL` and `service_role` key into `.env`

## 2. Backend setup

```bash
cd backend
cp .env.example .env
# Fill in all values in .env

python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Download spaCy model (required for guardrails)
python -m spacy download en_core_web_sm

# Run the API
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

## 3. Wire existing dashboard

In your existing Next.js health dashboard, after every Fitbit API call, add:

```typescript
// In your existing Fitbit sync function, after you get fitbit data:
await fetch('http://localhost:8000/ingest/wearable', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: session.user.id,
    date: today,
    data: fitbitResponse
  })
})
```

Or call the Python service directly from your existing Next.js API route.

## 4. Test the guardrails

```bash
# Should be BLOCKED
curl -X POST http://localhost:8000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test", "query": "do I have diabetes?"}'

# Should be SAFE
curl -X POST http://localhost:8000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test", "query": "what was my HbA1c last month?"}'
```

## 5. LangSmith traces

Every LLM call is traced automatically. View at: https://smith.langchain.com
Project name: `saathi-phase0`

## 6. OpenClaw (WhatsApp inbound)

Configure OpenClaw on your VM to POST to:
`http://your-server-ip:8000/whatsapp/webhook`

With header: `X-OpenClaw-Secret: your-secret-token`

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | /ingest/report | Upload lab report PDF/image |
| POST | /rag/query | Chat with health data |
| POST | /brief/generate | Pre-appointment brief |
| POST | /digest/generate | Weekly health digest |
| POST | /whatsapp/webhook | OpenClaw inbound webhook |
| POST | /whatsapp/send-test | Manual outbound (dev only) |
| GET  | /health | Health check |

## Key architecture decisions explained

**Why spaCy + LLM for guardrails?**  
spaCy understands linguistic structure (subject-verb-object relationships),
not just keywords. "I might have sugar problems" is caught by spaCy's
dependency parsing even though none of the words are in a blacklist.
The LLM classifier catches nuanced cases spaCy misses.

**Why OpenAI gpt-4o-mini for classification?**  
Fast (~200ms) and cheap (~$0.0001 per query). The classifier only needs
to return SAFE/BLOCKED — it doesn't need to generate a good response.

**Why context-only system prompt?**  
The model is explicitly told: if it's not in the retrieved documents,
say you don't know. This prevents the model from using its training
knowledge to answer health questions — which is where hallucination risk lives.

**Why embed wearable data?**  
Without embeddings, you can only retrieve wearable data by date range.
With embeddings, a query like "has my energy been low?" retrieves the most
relevant wearable snapshots even if the user doesn't specify dates.

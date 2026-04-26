"""
routers/rag.py

POST /rag/query — core chat endpoint

Pipeline:
1. Guardrails (spaCy → LLM classifier → sycophancy check)
2. Embed the query
3. Retrieve from Supabase (labs + wearable)
4. Build context from new structured schema (labs, clinical_notes, risk_scores, vitals)
5. Call OpenAI with strict context-only system prompt
6. Save to chat history
7. Return response with citations
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from langsmith import traceable
from openai import AsyncOpenAI
from pydantic import BaseModel

from config import settings
from db.client import (
    get_lab_reports,
    get_recent_chat,
    get_wearable_snapshots,
    save_message,
    similarity_search_labs,
    similarity_search_wearable,
)
from services.guardrails import SAFE_RESPONSE, run_guardrails
from services.wearable_sync import embed_text

router = APIRouter()

# openAI limit reached
# openai = AsyncOpenAI(api_key=settings.openai_api_key)

# Option 1: OpenRouter (active)
openai = AsyncOpenAI(
    api_key=settings.openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)

# Option 2: Direct OpenAI (fallback)
# openai = AsyncOpenAI(api_key=settings.openai_api_key)
# MODEL = "gpt-4o"

# Option 3: Claude via OpenRouter (second fallback)
# openai = AsyncOpenAI(
#     api_key=settings.openrouter_api_key,
#     base_url="https://openrouter.ai/api/v1",
# )
# MODEL = "anthropic/claude-sonnet-4-5"


class QueryRequest(BaseModel):
    user_id: str = "a6c75706-96a9-4465-aea2-7807f8df17d8"  # POC default
    query: str


# ── System prompt ─────────────────────────────────────────────────────────────

BASE_SYSTEM = """You are Saathi, a personal health data assistant.

YOUR ONLY JOB: Help the user understand their OWN health data.

ABSOLUTE RULES — no exceptions:
1. Answer ONLY using the retrieved documents provided below.
2. If the answer is not in the documents, say exactly:
   "I don't have that information in your records."
   Do not guess, infer, or use general medical knowledge.
3. NEVER diagnose, interpret medical meaning, or recommend treatment.
   If asked, say: "Saathi shows your data. Please discuss what it means with your doctor."
4. NEVER agree with a user's self-diagnosis.
5. Every data point you mention MUST cite its source and date:
   "Your [metric] on [date] from [lab/source] was [value]."
6. If a metric has a stage_classification (e.g. "Deficiency", "Pre-Diabetic"),
   you may state it factually: "Your Vitamin D was 8.98 ng/mL, classified as Deficiency."
   Do NOT explain what that means medically beyond what is in the documents.
7. Report exactly what the data shows — do not soften bad trends.

ANTI-SYCOPHANCY:
If a user disagrees with your answer, re-read the retrieved documents and report
what they actually say. Only change your answer if the documents support the user's claim.

CONTEXT SECTIONS AVAILABLE:
- Lab results (value, unit, flag, stage_classification per metric)
- Clinical notes (morphology, impressions, pathologist comments)
- Risk scores (AI-generated scores with basis and interpretation)
- Vitals (physical examination measurements)
- Wearable data (daily activity, sleep, heart rate)

Retrieved documents:
{context}"""


# ── Context builder — uses all schema sections ────────────────────────────────

def build_context(lab_docs: list[dict], wearable_docs: list[dict]) -> str:
    parts = []

    if lab_docs:
        parts.append("=== Lab Reports ===")
        for doc in lab_docs:
            date_str = doc.get("report_date", "unknown date")
            lab      = doc.get("lab_name", "unknown lab")
            sd       = doc.get("structured_data", {})
            if isinstance(sd, str):
                import json as _json
                try:
                    sd = _json.loads(sd)
                except Exception:
                    sd = {}

            parts.append(f"\n[{date_str} — {lab}]")

            # Labs section
            labs = sd.get("labs") or sd.get("metrics", {})
            if labs:
                parts.append("  Lab Values:")
                for name, data in labs.items():
                    if not isinstance(data, dict):
                        continue
                    val   = data.get("value", "")
                    unit  = data.get("unit") or ""
                    flag  = data.get("flag") or ""
                    stage = data.get("stage_classification") or ""
                    ref   = data.get("reference_range") or ""

                    flag_str  = f" [{flag}]"   if flag  and flag  not in ("Normal", "") else ""
                    stage_str = f" ({stage})"  if stage else ""
                    ref_str   = f" ref:{ref}"  if ref   else ""
                    parts.append(f"    {name}: {val} {unit}{flag_str}{stage_str}{ref_str}")

            # Clinical notes
            notes = sd.get("clinical_notes", {})
            if notes:
                parts.append("  Clinical Notes:")
                for name, data in notes.items():
                    if isinstance(data, dict):
                        parts.append(f"    {name}: {data.get('value', '')}")

            # Risk scores
            risks = sd.get("risk_scores", {})
            if risks:
                parts.append("  Risk Scores:")
                for name, data in risks.items():
                    if isinstance(data, dict):
                        score      = data.get("score", "")
                        acceptable = data.get("acceptable_score", "")
                        horizon    = data.get("time_horizon", "")
                        interp     = data.get("interpretation", "")
                        parts.append(
                            f"    {name}: {score}"
                            + (f" (acceptable: {acceptable})" if acceptable else "")
                            + (f" | {horizon}" if horizon else "")
                            + (f" | {interp}" if interp else "")
                        )

            # Vitals
            vitals = sd.get("vitals", {})
            if vitals:
                parts.append("  Vitals:")
                for name, data in vitals.items():
                    if isinstance(data, dict):
                        parts.append(f"    {name}: {data.get('value', '')} {data.get('unit', '')}")

            # Impressions
            impressions = sd.get("impressions", [])
            if impressions:
                parts.append("  Impressions:")
                for imp in impressions:
                    parts.append(f"    - {imp}")

    if wearable_docs:
        parts.append("\n=== Wearable Data ===")
        for row in wearable_docs:
            steps    = row.get("steps", "N/A")
            sleep    = row.get("sleep_hours", "N/A")
            hr       = row.get("resting_hr", "N/A")
            active   = row.get("active_minutes", "N/A")
            calories = row.get("calories", "N/A")
            parts.append(
                f"  [{row.get('date')}] Steps:{steps} | Sleep:{sleep}h | "
                f"HR:{hr}bpm | Active:{active}min | Calories:{calories}"
            )

    return "\n".join(parts) if parts else "No health records found for this user."


def build_sources(lab_docs: list[dict], wearable_docs: list[dict]) -> list[dict]:
    sources = []
    for doc in lab_docs:
        sources.append({
            "type":  "lab_report",
            "id":    doc.get("id"),
            "date":  doc.get("report_date"),
            "lab":   doc.get("lab_name"),
        })
    if wearable_docs:
        sources.append({
            "type":       "wearable",
            "date_range": f"{wearable_docs[-1].get('date')} to {wearable_docs[0].get('date')}",
            "count":      len(wearable_docs),
        })
    return sources


# ── RAG core ──────────────────────────────────────────────────────────────────

@traceable(name="rag-query")
async def run_rag(
    user_id: str,
    query: str,
    sycophancy_note: str | None,
) -> tuple[str, list]:
    query_embedding = await embed_text(query)

    lab_docs      = await similarity_search_labs(user_id, query_embedding, top_k=3)
    wearable_docs = await similarity_search_wearable(user_id, query_embedding, top_k=7)

    # Fallback to most recent if similarity search empty
    if not lab_docs:
        lab_docs = await get_lab_reports(user_id, limit=2)
    if not wearable_docs:
        wearable_docs = await get_wearable_snapshots(user_id, days=14)

    context = build_context(lab_docs, wearable_docs)
    sources = build_sources(lab_docs, wearable_docs)

    system = BASE_SYSTEM.format(context=context)
    if sycophancy_note:
        system += f"\n\nNOTE FOR THIS RESPONSE: {sycophancy_note}"

    history  = await get_recent_chat(user_id, limit=6)
    messages = [{"role": "system", "content": system}]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": query})

    response = await openai.chat.completions.create(
        model="gpt-4o",
        temperature=0.2,
        messages=messages,
    )
    answer = response.choices[0].message.content
    return answer, sources


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/query")
async def query(req: QueryRequest):
    guard = await run_guardrails(
        query=req.query,
        previous_assistant_response=None,
    )

    await save_message(
        user_id=req.user_id,
        role="user",
        content=req.query,
        was_blocked=guard["blocked"],
    )

    if guard["blocked"]:
        await save_message(
            user_id=req.user_id,
            role="assistant",
            content=guard["safe_response"],
            was_blocked=True,
        )
        return {
            "response":    guard["safe_response"],
            "sources":     [],
            "blocked":     True,
            "disclaimer":  "Saathi shows your data. It does not provide medical advice.",
        }

    answer, sources = await run_rag(
        user_id=req.user_id,
        query=req.query,
        sycophancy_note=guard.get("sycophancy_note"),
    )

    await save_message(
        user_id=req.user_id,
        role="assistant",
        content=answer,
        sources=sources,
    )

    return {
        "response":   answer,
        "sources":    sources,
        "blocked":    False,
        "disclaimer": "Saathi shows your data. It does not provide medical advice.",
    }

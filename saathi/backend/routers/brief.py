"""
routers/brief.py — Pre-appointment brief generator
"""
from fastapi import APIRouter
from langsmith import traceable
from openai import AsyncOpenAI
from pydantic import BaseModel

from config import settings
from db.client import get_lab_reports, get_wearable_snapshots

router = APIRouter()

# #openAI rate limit reached
openai = AsyncOpenAI(api_key=settings.openai_api_key)
# # Option 1: OpenRouter (active)
# openai = AsyncOpenAI(
#     api_key=settings.openrouter_api_key,
#     base_url="https://openrouter.ai/api/v1",
# )

# Option 2: Direct OpenAI (fallback)
# openai = AsyncOpenAI(api_key=settings.openai_api_key)
# MODEL = "gpt-4o"

# Option 3: Claude via OpenRouter (second fallback)
# openai = AsyncOpenAI(
#     api_key=settings.openrouter_api_key,
#     base_url="https://openrouter.ai/api/v1",
# )
# MODEL = "anthropic/claude-sonnet-4-5"

class BriefRequest(BaseModel):
    user_id: str = "a6c75706-96a9-4465-aea2-7807f8df17d8"
    appointment_type: str = "general checkup"
    member_id: str | None = None


BRIEF_SYSTEM = """You are Saathi, a health data assistant preparing a pre-appointment brief.

Using ONLY the health data provided below, create a concise brief for a doctor's appointment.

Structure your response exactly as:

## What Changed Since Last Report
[List metric changes between the most recent and previous reports, with exact values and dates]

## Stable Metrics
[List metrics that have been consistent, with values]

## Wearable Trends (Last 30 Days)
[Summarise sleep, steps, HR trends — factual, ignore null or 0 values, no interpretation]

## Questions to Ask the Doctor
[3-5 specific questions based purely on what the data shows — not medical advice]

Rules:
- Use only the data provided. Do not add information not in the data.
- Do not interpret what the results mean medically.
- Do not suggest diagnoses or treatments.
- Every metric mentioned must cite its source report and date.
- If data is insufficient for a section, say "Insufficient data available."
- Ignore any wearable metric with a value of 0 or null — these indicate missing data, not real readings. Do not mention or ask questions about zero-value metrics.

Health data:
{context}"""


@traceable(name="generate-brief")
@router.post("/generate")
async def generate_brief(req: BriefRequest):
    labs     = await get_lab_reports(req.user_id, limit=3, member_id=req.member_id)
    wearable = await get_wearable_snapshots(req.user_id, days=30, member_id=req.member_id)

    # Build context
    context_parts = []
    for lab in labs:
        metrics = lab.get("structured_data", {}).get("metrics", {})
        context_parts.append(f"\nLab report {lab.get('report_date')} ({lab.get('lab_name', 'unknown lab')}):")
        for name, data in metrics.items():
            context_parts.append(f"  {name}: {data.get('value')} {data.get('unit', '')} — ref: {data.get('reference_range', 'N/A')} {data.get('flag', '')}")

    if wearable:
        context_parts.append(f"\nWearable data ({len(wearable)} days):")
        avg_steps = sum(r.get("steps", 0) or 0 for r in wearable) / len(wearable)
        avg_sleep = sum(r.get("sleep_hours", 0) or 0 for r in wearable) / len(wearable)
        avg_hr    = sum(r.get("resting_hr", 0) or 0 for r in wearable) / len(wearable)
        context_parts.append(f"  Avg steps: {avg_steps:.0f}, Avg sleep: {avg_sleep:.1f}h, Avg resting HR: {avg_hr:.0f} bpm")

    
    context = "\n".join(context_parts) or "No health data available."

    response = await openai.chat.completions.create(
        model="gpt-4o",
        temperature=0.1,
        messages=[
            {"role": "system", "content": BRIEF_SYSTEM.format(context=context)},
            {"role": "user",   "content": f"Generate a pre-appointment brief for my {req.appointment_type} appointment."},
        ],
    )

    return {
        "brief": response.choices[0].message.content,
        "appointment_type": req.appointment_type,
        "data_sources": {
            "lab_reports": len(labs),
            "wearable_days": len(wearable),
        },
        "disclaimer": "This brief summarises your recorded data only. It does not constitute medical advice.",
    }

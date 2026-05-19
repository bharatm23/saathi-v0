"""
routers/digest.py — Weekly health digest
"""
from fastapi import APIRouter
from langsmith import traceable
from openai import AsyncOpenAI
from pydantic import BaseModel

from config import settings
from db.client import get_lab_reports, get_wearable_snapshots

router = APIRouter()

# # #openAI limit reached
# # openai = AsyncOpenAI(api_key=settings.openai_api_key)
# # Option 1: OpenRouter (active)
# openai = AsyncOpenAI(
#     api_key=settings.openrouter_api_key,
#     base_url="https://openrouter.ai/api/v1",
# )

# Option 2: Direct OpenAI (fallback)
openai = AsyncOpenAI(api_key=settings.openai_api_key)
MODEL = "gpt-4o"

# Option 3: Claude via OpenRouter (second fallback)
# openai = AsyncOpenAI(
#     api_key=settings.openrouter_api_key,
#     base_url="https://openrouter.ai/api/v1",
# )
# MODEL = "anthropic/claude-sonnet-4-5"


class DigestRequest(BaseModel):
    user_id: str = "a6c75706-96a9-4465-aea2-7807f8df17d8"
    period_days: int = 7


DIGEST_SYSTEM = """You are Saathi generating a weekly health digest.

Using ONLY the data provided, write a brief, readable summary in this exact format:

**This Week**
[2-3 sentences on what changed — use exact numbers, cite dates]

**Improving**
[bullet: metric that got better, with values]

**Watch**  
[bullet: metric that declined or needs attention, with values]

**One Action**
[Single behavioural suggestion based purely on what the data shows — 
 e.g. "You slept under 6 hours on 4 nights" NOT "You should see a doctor about X"]

Rules:
- Data only. No medical interpretation.
- No diagnosis, no treatment recommendations.
- If a metric is stable, say so with the values.
- If there is insufficient data, say so plainly.

Data:
{context}"""


@traceable(name="generate-digest")
@router.post("/generate")
async def generate_digest(req: DigestRequest):
    wearable = await get_wearable_snapshots(req.user_id, days=req.period_days)
    labs = await get_lab_reports(req.user_id, limit=1)

    context_parts = []
    if wearable:
        context_parts.append(f"Wearable data for last {req.period_days} days:")
        for row in wearable:
            context_parts.append(
                f"  {row['date']}: steps={row.get('steps', 'N/A')}, "
                f"sleep={row.get('sleep_hours', 'N/A')}h, "
                f"hr={row.get('resting_hr', 'N/A')} bpm"
            )
    if labs:
        lab = labs[0]
        context_parts.append(f"\nMost recent lab report: {lab.get('report_date')} ({lab.get('lab_name', '')})")
        for name, data in lab.get("structured_data", {}).get("metrics", {}).items():
            context_parts.append(f"  {name}: {data.get('value')} {data.get('unit', '')} {data.get('flag', '')}")

    context = "\n".join(context_parts) or "No data available for this period."

    response = await openai.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.2,
        messages=[
            {"role": "system", "content": DIGEST_SYSTEM.format(context=context)},
            {"role": "user",   "content": "Generate my weekly health digest."},
        ],
    )

    return {
        "digest": response.choices[0].message.content,
        "period_days": req.period_days,
        "disclaimer": "This digest summarises your recorded data. It does not provide medical advice.",
    }

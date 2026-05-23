"""
routers/digest.py — Weekly health digest
"""
from datetime import date, timedelta
from fastapi import APIRouter
from langsmith import traceable
from openai import AsyncOpenAI
from pydantic import BaseModel

from config import settings
from db.client import get_lab_reports, get_wearable_snapshots, get_client

router = APIRouter()

openai = AsyncOpenAI(api_key=settings.openai_api_key)
MODEL = "gpt-4o-mini"


class DigestRequest(BaseModel):
    user_id: str = "a6c75706-96a9-4465-aea2-7807f8df17d8"
    period_days: int = 7


DIGEST_SYSTEM = """You are Saathi generating a health digest.

Using ONLY the data provided, write a brief, readable summary in this exact format:

**This Week**
[2-3 sentences on what changed — use exact numbers, cite dates. If data is stale, clearly state when it is from.]

**Improving**
[bullet: metric that got better, with values]

**Watch**
[bullet: metric that declined or needs attention, with values]

**One Action**
[Single behavioural suggestion based purely on what the data shows. 
 For wearable data: e.g. "You slept under 6 hours on 4 nights."
 For lab results: suggest a lifestyle adjustment only (e.g. "Your Vitamin D is low - time outdoors 
 and dietary sources like eggs and fish can help." NOT medical treatment or medication advice.)
 Never recommend seeing a doctor or prescribe treatment.]

Rules:
- Data only. No medical interpretation.
- No diagnosis, no treatment recommendations.
- Ignore any metric with a value of 0 or null — these indicate missing data, not real readings.
- If wearable data is from a past date, clearly mention this (e.g. "Your last sync was from Nov 2020").
- If a metric is stable, say so with the values.
- If there is insufficient data, say so plainly.

Data:
{context}"""


@traceable(name="generate-digest")
@router.post("/generate")
async def generate_digest(req: DigestRequest):
    wearable = await get_wearable_snapshots(req.user_id, days=req.period_days)
    labs = await get_lab_reports(req.user_id, limit=2)

    context_parts = []

    # ── Wearable daily snapshots ──────────────────────────────
    if wearable:
        latest_date = wearable[0].get("date", "")
        oldest_date = wearable[-1].get("date", "")
        days_stale = (date.today() - date.fromisoformat(latest_date)).days if latest_date else None

        if days_stale and days_stale > req.period_days:
            context_parts.append(
                f"NOTE: Most recent wearable sync is from {latest_date} ({days_stale} days ago). "
                f"No data available for the last {req.period_days} days. "
                f"Data shown below is from {oldest_date} to {latest_date}."
            )
        else:
            context_parts.append(f"Wearable data ({oldest_date} to {latest_date}):")

        for row in wearable:
            line_parts = [f"  {row['date']}:"]
            if row.get("steps"):       line_parts.append(f"steps={row['steps']}")
            if row.get("sleep_hours"): line_parts.append(f"sleep={row['sleep_hours']}h")
            if row.get("resting_hr"):  line_parts.append(f"hr={row['resting_hr']}bpm")
            if row.get("calories"):    line_parts.append(f"calories={row['calories']}")
            if row.get("active_minutes"): line_parts.append(f"active={row['active_minutes']}min")
            if len(line_parts) > 1:
                context_parts.append(" ".join(line_parts))
    else:
        context_parts.append("No wearable data available.")

    # ── Period summaries (30d / 1y) ───────────────────────────
    try:
        period_res = (
            get_client().table("wearable_snapshots")
            .select("date, source, raw_data")
            .eq("user_id", req.user_id)
            .in_("source", ["fitbit_30d", "fitbit_1y"])
            .order("date", desc=True)
            .limit(14)
            .execute()
        )
        if period_res.data:
            context_parts.append("\nPeriod summaries:")
            for row in period_res.data:
                raw = row.get("raw_data") or {}
                label = "30-day" if row["source"] == "fitbit_30d" else "1-year"
                for m in raw.get("metrics", []):
                    avg = m.get("avg")
                    if avg and str(avg) not in ("—", "", "0", "0.0"):
                        context_parts.append(
                            f"  {label} {m.get('key')}: avg={avg} "
                            f"min={m.get('min','—')} max={m.get('max','—')}"
                        )
    except Exception as e:
        print(f"Period summary fetch error: {e}")

    # ── Lab reports ───────────────────────────────────────────
    if labs:
        for lab in labs:
            context_parts.append(
                f"\nLab report: {lab.get('report_date')} ({lab.get('lab_name', 'unknown lab')})"
            )
            sd = lab.get("structured_data", {})
            labs_data = sd.get("labs") or sd.get("metrics", {})
            for name, data in labs_data.items():
                if not isinstance(data, dict):
                    continue
                val  = data.get("value", "")
                unit = data.get("unit", "")
                flag = data.get("flag", "")
                if val and str(val) not in ("0", "0.0", ""):
                    context_parts.append(f"  {name}: {val} {unit} {flag}".strip())
    else:
        context_parts.append("\nNo lab reports available.")

    context = "\n".join(context_parts)

    response = await openai.chat.completions.create(
        model=MODEL,
        temperature=0.2,
        messages=[
            {"role": "system", "content": DIGEST_SYSTEM.format(context=context)},
            {"role": "user",   "content": f"Generate my {req.period_days}-day health digest."},
        ],
    )

    return {
        "digest": response.choices[0].message.content,
        "period_days": req.period_days,
        "disclaimer": "This digest summarises your recorded data. It does not provide medical advice.",
    }
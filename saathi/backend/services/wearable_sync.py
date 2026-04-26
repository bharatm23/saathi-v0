"""
services/wearable_sync.py

Bridges your existing Fitbit/health dashboard data into Supabase
wearable_snapshots table. Call sync_day() after every Fitbit API
response to keep the RAG layer populated.

Your existing dashboard already fetches the Fitbit data — this file
is the write layer that stores it so the RAG layer can access it.
"""
from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any

from langsmith import traceable
from openai import AsyncOpenAI

from config import settings
from db.client import upsert_wearable_snapshot

# #openAI rate limit reached
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


# ── Metric normalisation ──────────────────────────────────────
# Maps your existing dashboard field names → Supabase column names.
# Add entries here as you add more wearable data sources.
FIELD_MAP = {
    # Fitbit / Google Fit field names → Supabase columns
    "steps":           "steps",
    "totalSteps":      "steps",
    "caloriesOut":     "calories",
    "calories":        "calories",
    "distance":        "distance_km",
    "distanceKm":      "distance_km",
    "fairlyActiveMinutes": "active_minutes",
    "veryActiveMinutes":   "active_minutes",
    "activeMinutes":   "active_minutes",
    "restingHeartRate": "resting_hr",
    "restingHR":       "resting_hr",
    "sleepDuration":   "sleep_hours",
    "totalSleepHours": "sleep_hours",
    "sleepEfficiency": "sleep_efficiency",
    "weight":          "weight_kg",
    "weightKg":        "weight_kg",
}


def normalise_metrics(raw: dict) -> dict:
    """
    Convert a raw Fitbit API response dict to Supabase column names.
    Only populated fields are returned — null values are excluded
    so the upsert doesn't overwrite good data with nulls.
    """
    metrics: dict[str, Any] = {}
    for raw_key, col in FIELD_MAP.items():
        if raw_key in raw and raw[raw_key] is not None:
            val = raw[raw_key]
            # Convert minutes to hours for sleep fields
            if col == "sleep_hours" and val > 24:
                val = round(val / 60, 2)
            metrics[col] = val
    return metrics


def build_embedding_text(snapshot_date: date, metrics: dict, raw: dict) -> str:
    """
    Build a natural-language string from the snapshot for embedding.
    Richer text = better RAG retrieval.
    """
    parts = [f"Health data for {snapshot_date.isoformat()}."]
    if metrics.get("steps"):
        parts.append(f"Steps: {metrics['steps']:,}.")
    if metrics.get("sleep_hours"):
        parts.append(f"Sleep: {metrics['sleep_hours']} hours.")
    if metrics.get("sleep_efficiency"):
        parts.append(f"Sleep efficiency: {metrics['sleep_efficiency']}%.")
    if metrics.get("resting_hr"):
        parts.append(f"Resting heart rate: {metrics['resting_hr']} bpm.")
    if metrics.get("calories"):
        parts.append(f"Calories burned: {metrics['calories']}.")
    if metrics.get("active_minutes"):
        parts.append(f"Active minutes: {metrics['active_minutes']}.")
    if metrics.get("weight_kg"):
        parts.append(f"Weight: {metrics['weight_kg']} kg.")
    return " ".join(parts)


@traceable(name="embed-text")
async def embed_text(text: str) -> list[float]:
    """Generate a 1536-dim embedding using OpenAI text-embedding-3-small."""
    response = await openai.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding


@traceable(name="sync-wearable-day")
async def sync_day(
    user_id: str,
    snapshot_date: date,
    raw_fitbit_response: dict,
    source: str = "fitbit",
) -> dict:
    """
    Call this function from your existing Fitbit sync route after
    you receive data from the Fitbit API.

    Example usage in your existing dashboard API route:
    -------------------------------------------------------
    from services.wearable_sync import sync_day
    from datetime import date

    # After your existing Fitbit fetch:
    await sync_day(
        user_id=current_user.id,
        snapshot_date=date.today(),
        raw_fitbit_response=fitbit_data,
    )
    -------------------------------------------------------
    """
    metrics = normalise_metrics(raw_fitbit_response)

    if not metrics:
        # Nothing we can store from this response — skip
        return {"stored": False, "reason": "no recognised metrics in response"}

    embedding_text = build_embedding_text(snapshot_date, metrics, raw_fitbit_response)
    embedding = await embed_text(embedding_text)

    stored = await upsert_wearable_snapshot(
        user_id=user_id,
        snapshot_date=snapshot_date,
        metrics=metrics,
        raw_data=raw_fitbit_response,
        embedding=embedding,
        source=source,
    )

    return {"stored": True, "date": snapshot_date.isoformat(), "metrics_saved": list(metrics.keys())}


@traceable(name="sync-wearable-batch")
async def sync_batch(
    user_id: str,
    daily_data: list[dict],
    source: str = "fitbit",
) -> list[dict]:
    """
    Sync multiple days at once. daily_data should be a list of:
    {"date": "2025-03-01", ...fitbit fields...}
    """
    results = []
    for row in daily_data:
        raw_date = row.get("date") or row.get("dateTime")
        if not raw_date:
            continue
        snapshot_date = date.fromisoformat(raw_date[:10])
        result = await sync_day(user_id, snapshot_date, row, source)
        results.append(result)
    return results

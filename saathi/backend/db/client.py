"""
db/client.py
Supabase client + typed helpers for every table Saathi uses.
"""
from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any
from uuid import UUID

from supabase import create_client, Client
from config import settings

# ── Singleton client ──────────────────────────────────────────
# Uses the service-role key so backend can bypass RLS when needed.
# Never expose this key to the frontend.
_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client


# ── Lab Reports ──────────────────────────────────────────────

async def insert_lab_report(
    user_id: str,
    raw_text: str,
    structured_data: dict,
    embedding: list[float],
    report_date: date | None = None,
    lab_name: str | None = None,
    file_name: str | None = None,
    source: str = "upload",
    member_id: str | None = None,
    member_name: str | None = None,
) -> dict:
    db = get_client()
    payload = {
        "user_id": user_id,
        "raw_text": raw_text,
        "structured_data": structured_data,
        "embedding": embedding,
        "source": source,
    }
    if report_date:
        payload["report_date"] = report_date.isoformat()
    if lab_name:
        payload["lab_name"] = lab_name
    if file_name:
        payload["file_name"] = file_name
    if member_id:
        payload["member_id"] = member_id
    if member_id and not member_name:
        result = db.table("family_members").select("name").eq("id", member_id).single().execute()
        member_name = result.data.get("name") if result.data else None
    if member_name:
        payload["member_name"] = member_name

    result = db.table("lab_reports").insert(payload).execute()
    return result.data[0]


async def get_lab_reports(user_id: str, limit: int = 5) -> list[dict]:
    """Fetch most recent lab reports for a user, ordered newest first."""
    db = get_client()
    result = (
        db.table("lab_reports")
        .select("id, report_date, lab_name, structured_data, raw_text, uploaded_at")
        .eq("user_id", user_id)
        .order("report_date", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data


async def similarity_search_labs(
    user_id: str, query_embedding: list[float], top_k: int = 3
) -> list[dict]:
    """Vector similarity search over lab reports for a user."""
    db = get_client()
    # Uses pgvector's <=> cosine distance operator via rpc
    result = db.rpc(
        "match_lab_reports",
        {
            "query_embedding": query_embedding,
            "match_user_id": user_id,
            "match_count": top_k,
        },
    ).execute()
    return result.data


# ── Wearable Snapshots ───────────────────────────────────────

async def upsert_wearable_snapshot(
    user_id: str,
    snapshot_date: date,
    metrics: dict,
    raw_data: dict,
    embedding: list[float],
    source: str = "fitbit",
    member_id: str | None = None
) -> dict:
    """
    Insert or update a wearable snapshot for a given user + date.
    metrics keys must match column names: steps, calories, distance_km,
    active_minutes, resting_hr, sleep_hours, sleep_efficiency, weight_kg.
    """
    db = get_client()
    payload = {
        "user_id": user_id,
        "date": snapshot_date.isoformat(),
        "source": source,
        "embedding": embedding,
        **{k: v for k, v in metrics.items() if v is not None},
    }
    if raw_data:  # only include if non-empty
        payload["raw_data"] = raw_data
    if member_id:
        payload["member_id"] = member_id
    result = (
        db.table("wearable_snapshots")
        .upsert(payload, on_conflict="user_id,date,source,member_id")
        .execute()
    )
    return result.data[0]


async def get_wearable_snapshots(user_id: str, days: int = 30) -> list[dict]:
    db = get_client()
    result = (
        db.table("wearable_snapshots")
        .select("date, steps, calories, distance_km, active_minutes, resting_hr, sleep_hours, sleep_efficiency, weight_kg, source, raw_data")
        .eq("user_id", user_id)
        .eq("source", "fitbit")
        .order("date", desc=True)
        .limit(days)
        .execute()
    )
    return result.data


async def similarity_search_wearable(
    user_id: str, query_embedding: list[float], top_k: int = 5
) -> list[dict]:
    db = get_client()
    result = db.rpc(
        "match_wearable_snapshots",
        {
            "query_embedding": query_embedding,
            "match_user_id": user_id,
            "match_count": top_k,
        },
    ).execute()
    return result.data


# ── Chat History ─────────────────────────────────────────────

async def save_message(
    user_id: str,
    role: str,
    content: str,
    sources: list[dict] | None = None,
    was_blocked: bool = False,
) -> dict:
    db = get_client()
    result = (
        db.table("chat_messages")
        .insert({
            "user_id": user_id,
            "role": role,
            "content": content,
            "sources": sources or [],
            "was_blocked": was_blocked,
        })
        .execute()
    )
    return result.data[0]


async def get_recent_chat(user_id: str, limit: int = 10) -> list[dict]:
    """Fetch recent chat history, ordered oldest first for context window."""
    db = get_client()
    result = (
        db.table("chat_messages")
        .select("role, content, created_at, sources, was_blocked")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return list(reversed(result.data))

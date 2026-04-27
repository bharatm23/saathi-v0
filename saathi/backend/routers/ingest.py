"""
routers/ingest.py

Upload flow:
1. Frontend uploads file directly to Supabase Storage (bucket: lab-reports)
2. Frontend calls POST /ingest/report with { storage_path, file_name }
3. Backend fetches file from Supabase Storage signed URL
4. Backend runs extraction pipeline
5. Backend saves structured data to lab_reports table
"""
from datetime import datetime, date as date_type
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from supabase import create_client
from db.client import get_client
from config import settings
from services.ingest_report import ingest_lab_report
from services.wearable_sync import sync_day
import httpx

router = APIRouter()
security = HTTPBearer(auto_error=False)


def get_user_id(credentials: HTTPAuthorizationCredentials | None) -> str:
    if not credentials:
        return "a6c75706-96a9-4465-aea2-7807f8df17d8"
    try:
        client = create_client(settings.supabase_url, settings.supabase_service_key)
        user = client.auth.get_user(credentials.credentials)
        return user.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


class IngestFromStorageRequest(BaseModel):
    storage_path: str   # e.g. "user-id/filename.pdf"
    file_name: str
    user_id: str = ""   # fallback if no JWT


@router.post("/report")
async def ingest_from_storage(
    payload: IngestFromStorageRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    uid = get_user_id(credentials) if credentials else (payload.user_id or "a6c75706-96a9-4465-aea2-7807f8df17d8")

    # Get a signed URL from Supabase Storage
    try:
        client = create_client(settings.supabase_url, settings.supabase_service_key)
        signed = client.storage.from_("lab-reports").create_signed_url(
            payload.storage_path, expires_in=300  # 5 min
        )
        signed_url = signed.get("signedURL") or signed.get("signedUrl")
        if not signed_url:
            raise ValueError("No signed URL returned")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not get file from storage: {e}")

    # Fetch file bytes
    try:
        async with httpx.AsyncClient(timeout=60) as client_http:
            resp = await client_http.get(signed_url)
            resp.raise_for_status()
            file_bytes = resp.content
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not download file: {e}")

    # Run extraction
    try:
        result = await ingest_lab_report(
            user_id=uid,
            file_bytes=file_bytes,
            file_name=payload.file_name,
            source="upload",
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result.get("error", "Extraction failed"))

    return result

class WearablePayload(BaseModel):
    user_id: str
    date: str
    data: dict
    skip_raw: bool = False

@router.post("/wearable")
async def ingest_wearable(payload: WearablePayload):
    try:
        print(f"🔵 Wearable payload received: user={payload.user_id} date={payload.date} keys={list(payload.data.keys())}")
        snapshot_date = date_type.fromisoformat(payload.date[:10])
        result = await sync_day(
            user_id=payload.user_id,
            snapshot_date=snapshot_date,
            raw_fitbit_response={} if payload.skip_raw else payload.data,
        )
        print(f"🟢 sync_day result: {result}")
        return result
    except Exception as e:
        print(f"🔴 sync_day error: {e}")
        return {"stored": False, "error": str(e)}


class PeriodWearablePayload(BaseModel):
    user_id: str
    period: str
    sync_date: str
    metric_key: str
    avg: str | None = None
    min: str | None = None
    max: str | None = None
    trend: str | None = None

@router.post("/wearable/period")
async def ingest_wearable_period(payload: PeriodWearablePayload):
    db = get_client()
    # Fetch existing row if present, merge new metric into it
    existing = db.table("wearable_period_summaries") \
        .select("metrics") \
        .eq("user_id", payload.user_id) \
        .eq("period", payload.period) \
        .eq("sync_date", payload.sync_date) \
        .single().execute()

    metrics = existing.data["metrics"] if existing.data else {}
    metrics[payload.metric_key] = {
        "avg": payload.avg, "min": payload.min,
        "max": payload.max, "trend": payload.trend
    }

    db.table("wearable_period_summaries").upsert({
        "user_id": payload.user_id,
        "period": payload.period,
        "sync_date": payload.sync_date,
        "metrics": metrics,
        "cached_at": datetime.utcnow().isoformat(),
    }, on_conflict="user_id,period,sync_date,source").execute()

    return {"stored": True}
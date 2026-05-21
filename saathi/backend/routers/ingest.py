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
from fastapi import APIRouter, HTTPException, Depends, Request
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
    member_id: str | None = None


@router.post("/report")
async def ingest_from_storage(
    payload: IngestFromStorageRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    uid = get_user_id(credentials) if credentials else (payload.user_id or "a6c75706-96a9-4465-aea2-7807f8df17d8")

    member_name = None
    if payload.member_id:
        try:
            db = get_client()

            member_res = (
                db.table("members")
                .select("name")
                .eq("id", payload.member_id)
                .eq("user_id", uid)
                .single()
                .execute()
            )
            member_name = member_res.data.get("name") if member_res.data else None

        except Exception as e:
            print(f"Could not fetch member name: {e}")

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
        # result = await ingest_lab_report(
        #     user_id=uid,
        #     file_bytes=file_bytes,
        #     file_name=payload.file_name,
        #     source="upload",
        #     member_id=payload.member_id,
        # )
        result = await ingest_lab_report(
            user_id=uid,
            file_bytes=file_bytes,
            file_name=payload.file_name,
            source="upload",
            member_id=payload.member_id,
            member_name=member_name,
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
    member_id: str | None = None

@router.post("/wearable")
async def ingest_wearable(payload: WearablePayload):
    try:
        print(f"🔵 Wearable payload received: user={payload.user_id} date={payload.date} keys={list(payload.data.keys())}")
        snapshot_date = date_type.fromisoformat(payload.date[:10])
        result = await sync_day(
            user_id=payload.user_id,
            snapshot_date=snapshot_date,
            raw_fitbit_response={} if payload.skip_raw else payload.data,
            member_id=payload.member_id,
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
    source: str = "fitbit"
    metric_key: str
    avg: str | None = None
    min: str | None = None
    max: str | None = None
    trend: str | None = None

# @router.post("/wearable/period")
# async def ingest_wearable_period(request: Request):
#     body = await request.json()
#     print(f"🔵 Period payload raw: {body}")
#     from db.client import get_client
#     from datetime import datetime

#     def clean(v: str | None) -> float | None:
#         try:
#             f = float(v)
#             return f if f > 0 else None
#         except (TypeError, ValueError):
#             return None

#     metrics_entry = {
#         "avg": clean(payload.avg),
#         "min": clean(payload.min),
#         "max": clean(payload.max),
#         "trend": payload.trend if payload.trend not in (None, "—") else None,
#     }

#     # Skip entirely if no usable data
#     if all(v is None for v in [metrics_entry["avg"], metrics_entry["min"], metrics_entry["max"]]):
#         return {"stored": False, "reason": "no valid data"}

#     db = get_client()
#     existing = db.table("wearable_period_summaries") \
#         .select("metrics") \
#         .eq("user_id", payload.user_id) \
#         .eq("period", payload.period) \
#         .eq("sync_date", payload.sync_date[:10]) \
#         .eq("source", payload.source) \
#         .execute()

#     metrics = existing.data[0]["metrics"] if existing.data else {}
#     metrics[payload.metric_key] = metrics_entry

#     db.table("wearable_period_summaries").upsert({
#         "user_id": payload.user_id,
#         "period": payload.period,
#         "sync_date": payload.sync_date[:10],
#         "source": payload.source,
#         "metrics": metrics,
#         "cached_at": datetime.utcnow().isoformat(),
#     }, on_conflict="user_id,period,sync_date,source").execute()

#     return {"stored": True, "metric": payload.metric_key}

@router.post("/wearable/period")
async def ingest_wearable_period(request: Request):
    # Period data handled by wearable_cache in the frontend
    # This endpoint is deprecated
    return {"stored": False, "reason": "deprecated"}

class WearableSummaryPayload(BaseModel):
    user_id: str
    period: str
    sync_date: str
    endpoint_key: str
    metrics: list[dict]

@router.post("/wearable/summary")
async def ingest_wearable_summary(payload: WearableSummaryPayload):
    try:
        from services.wearable_sync import embed_text, build_embedding_text
        from db.client import get_client
        from datetime import date as date_type

        summary_text = f"Fitbit {payload.period} summary for {payload.sync_date}. "
        summary_text += " ".join(
            f"{m.get('key','')}: {m.get('avg') or m.get('value','')} {m.get('unit','')}"
            for m in payload.metrics if m.get('value') not in ('—', '', None)
        )
        embedding = await embed_text(summary_text)
        db = get_client()
        db.table("wearable_snapshots").upsert({
            "user_id": payload.user_id,
            "date": payload.sync_date,
            "source": f"fitbit_{payload.period}",
            "raw_data": {"period": payload.period, "endpoint": payload.endpoint_key, "metrics": payload.metrics},
            "embedding": embedding,
        }, on_conflict="user_id,date,source").execute()
        return {"stored": True}
    except Exception as e:
        return {"stored": False, "error": str(e)}
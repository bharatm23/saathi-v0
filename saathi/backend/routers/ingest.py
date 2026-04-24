"""
routers/ingest.py
"""
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from supabase import create_client
from config import settings
from services.ingest_report import ingest_lab_report
from datetime import date as date_type
from services.wearable_sync import sync_day

router = APIRouter()
security = HTTPBearer(auto_error=False)

ALLOWED_TYPES = {
    "application/pdf", "image/jpeg", "image/png", "image/webp",
}
MAX_FILE_SIZE = 10 * 1024 * 1024


def get_user_id(credentials: HTTPAuthorizationCredentials | None) -> str:
    """Extract user ID from Supabase JWT. Falls back to POC UUID if no token."""
    if not credentials:
        return "a6c75706-96a9-4465-aea2-7807f8df17d8"  # POC fallback
    try:
        client = create_client(settings.supabase_url, settings.supabase_service_key)
        user = client.auth.get_user(credentials.credentials)
        return user.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@router.post("/report")
async def upload_report(
    file: UploadFile = File(...),
    user_id: str = Form(default=""),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    # Prefer JWT user ID over form field
    uid = get_user_id(credentials) if credentials else (user_id or "a6c75706-96a9-4465-aea2-7807f8df17d8")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max 10 MB.")

    try:
        result = await ingest_lab_report(
            user_id=uid,
            file_bytes=file_bytes,
            file_name=file.filename or "report.pdf",
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


@router.post("/wearable")
async def ingest_wearable(payload: WearablePayload):
    try:
        snapshot_date = date_type.fromisoformat(payload.date[:10])
        result = await sync_day(
            user_id=payload.user_id,
            snapshot_date=snapshot_date,
            raw_fitbit_response=payload.data,
        )
        return result
    except Exception as e:
        return {"stored": False, "error": str(e)}

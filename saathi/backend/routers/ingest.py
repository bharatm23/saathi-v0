"""
routers/ingest.py

POST /ingest/report  — upload a lab report PDF or image
"""
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from services.ingest_report import ingest_lab_report
from pydantic import BaseModel

router = APIRouter()

ALLOWED_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/report")
async def upload_report(
    file: UploadFile = File(...),
    user_id: str = Form(default="a6c75706-96a9-4465-aea2-7807f8df17d8"),    # replace with JWT auth in Phase 1
):
    """
    Upload a lab report PDF or image.
    Parses, extracts metrics dynamically, embeds, and stores in Supabase.
    Returns the list of metrics extracted so the UI can confirm what was captured.
    """
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"File type not supported. Upload a PDF or image. Got: {file.content_type}",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max 10 MB.")

    result = await ingest_lab_report(
        user_id=user_id,
        file_bytes=file_bytes,
        file_name=file.filename or "report.pdf",
        source="upload",
    )

    if not result["success"]:
        raise HTTPException(status_code=422, detail=result.get("error"))

    return result


class WearablePayload(BaseModel):
    user_id: str
    date: str
    data: dict

@router.post("/wearable")
async def ingest_wearable(payload: WearablePayload):
    """
    Called by the health dashboard after every Fitbit fetch.
    Fire-and-forget from the dashboard side.
    """
    from datetime import date as date_type
    from services.wearable_sync import sync_day

    try:
        snapshot_date = date_type.fromisoformat(payload.date[:10])
        result = await sync_day(
            user_id=payload.user_id,
            snapshot_date=snapshot_date,
            raw_fitbit_response=payload.data,
        )
        return result
    except Exception as e:
        # Never crash — dashboard doesn't depend on this succeeding
        return {"stored": False, "error": str(e)}
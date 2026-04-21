"""
routers/whatsapp.py

Receives forwarded documents from WhatsApp via OpenClaw webhook.
OpenClaw (running on VM) intercepts WhatsApp messages and POSTs them here.

Flow:
  Parent forwards PDF on WhatsApp → OpenClaw VM captures it →
  POSTs to /whatsapp/webhook → we ingest the file →
  we send back a plain-language summary via OpenClaw's outbound API
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request

from config import settings
from db.client import get_client
from services.ingest_report import ingest_lab_report

router = APIRouter()


# ── Helper: look up user_id by phone number ──────────────────
async def get_user_by_phone(phone: str) -> str | None:
    """
    Look up a Saathi user_id from their registered phone number.
    You'll need a `user_phones` table or store phone in user metadata.
    For Phase 0 POC: hardcode your test numbers here.
    """
    # TODO Phase 1: query a user_phones table in Supabase
    # For now, return None if not found (message is ignored)
    db = get_client()
    result = (
        db.table("user_phones")
        .select("user_id")
        .eq("phone", phone)
        .single()
        .execute()
    )
    if result.data:
        return result.data["user_id"]
    return None


# ── Helper: send WhatsApp reply via OpenClaw ─────────────────
async def send_via_openclaw(phone: str, message: str) -> None:
    """
    POST to OpenClaw VM to send a WhatsApp message.
    OpenClaw handles the actual WhatsApp delivery.
    """
    if not settings.openclaw_endpoint:
        return  # OpenClaw not configured in this env

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            await client.post(
                settings.openclaw_endpoint,
                json={"phone": phone, "message": message},
                headers={"Authorization": f"Bearer {settings.openclaw_secret}"},
            )
        except Exception as e:
            # Log but don't crash the ingest flow
            print(f"OpenClaw delivery failed: {e}")


# ── Background task: ingest + reply ──────────────────────────
async def process_whatsapp_document(
    user_id: str,
    phone: str,
    file_bytes: bytes,
    file_name: str,
) -> None:
    """Runs in background so webhook returns 200 immediately."""
    result = await ingest_lab_report(
        user_id=user_id,
        file_bytes=file_bytes,
        file_name=file_name,
        source="whatsapp",
    )

    if result["success"]:
        metrics = result.get("metrics_extracted", [])
        metric_list = ", ".join(metrics[:5]) + ("..." if len(metrics) > 5 else "")
        reply = (
            f"Got your report from {result.get('lab_name') or file_name}. "
            f"I found {len(metrics)} test results: {metric_list}. "
            f"Your Saathi dashboard has been updated. "
            f"Saathi shows your data only — please discuss results with your doctor."
        )
    else:
        reply = (
            "I received your file but could not read it clearly. "
            "Please send a clearer photo or a typed PDF."
        )

    await send_via_openclaw(phone, reply)


# ── Webhook endpoint ─────────────────────────────────────────
@router.post("/webhook")
async def whatsapp_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_openclaw_secret: str = Header(default=""),
):
    """
    OpenClaw POSTs here when a user forwards a document on WhatsApp.

    Expected payload from OpenClaw:
    {
      "from": "+91XXXXXXXXXX",
      "type": "document",
      "file_name": "report.pdf",
      "file_bytes_b64": "<base64 string>"
    }
    """
    # Verify OpenClaw secret
    if settings.openclaw_secret and x_openclaw_secret != settings.openclaw_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    payload = await request.json()
    msg_type = payload.get("type")
    phone = payload.get("from", "")

    # Only handle document messages
    if msg_type != "document":
        return {"status": "ignored", "reason": f"message type '{msg_type}' not handled"}

    # Look up user
    user_id = await get_user_by_phone(phone)
    if not user_id:
        await send_via_openclaw(
            phone,
            "This number is not registered with Saathi. "
            "Please ask your family member to add you in the Saathi app.",
        )
        return {"status": "ignored", "reason": "phone not registered"}

    # Decode file
    import base64
    file_b64 = payload.get("file_bytes_b64", "")
    if not file_b64:
        return {"status": "error", "reason": "no file content"}

    file_bytes = base64.b64decode(file_b64)
    file_name = payload.get("file_name", "whatsapp_report.pdf")

    # Ingest in background — return 200 immediately so OpenClaw doesn't retry
    background_tasks.add_task(
        process_whatsapp_document,
        user_id=user_id,
        phone=phone,
        file_bytes=file_bytes,
        file_name=file_name,
    )

    return {"status": "received", "processing": "background"}


# ── Manual outbound (for testing without full OpenClaw setup) ─
@router.post("/send-test")
async def send_test_message(phone: str, message: str):
    """
    Dev endpoint — manually trigger an outbound WhatsApp message via OpenClaw.
    For testing digests and briefs. Disable in production.
    """
    if settings.environment != "development":
        raise HTTPException(status_code=403, detail="Only available in development")
    await send_via_openclaw(phone, message)
    return {"status": "sent", "phone": phone}

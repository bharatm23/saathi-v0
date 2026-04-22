"""
main.py — Saathi Phase 0 FastAPI backend

LangSmith tracing is configured here at startup.
Every endpoint that calls an LLM is wrapped with @traceable()
in its respective service file, so traces flow automatically.
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings

# ── Item 4: LangSmith tracing — configure before any LLM calls ──
# These env vars are all LangSmith needs — no additional wrapping required.
os.environ["LANGCHAIN_TRACING_V2"]  = settings.langchain_tracing_v2
os.environ["LANGCHAIN_API_KEY"]     = settings.langchain_api_key
os.environ["LANGCHAIN_PROJECT"]     = settings.langchain_project

from routers import ingest, rag, brief, digest, whatsapp

app = FastAPI(
    title="Saathi API",
    description="Phase 0 — health memory layer",
    version="0.1.0",
)

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],   # POC only — lock this down in Phase 1
#     allow_credentials=False,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "https://your-app.vercel.app",  # add your actual Vercel URL
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router,    prefix="/ingest",    tags=["Ingestion"])
app.include_router(rag.router,       prefix="/rag",       tags=["RAG / Chat"])
app.include_router(brief.router,     prefix="/brief",     tags=["Pre-Appointment Brief"])
app.include_router(digest.router,    prefix="/digest",    tags=["Health Digest"])
app.include_router(whatsapp.router,  prefix="/whatsapp",  tags=["WhatsApp"])


@app.get("/health")
async def health():
    return {"status": "ok", "project": settings.langchain_project}

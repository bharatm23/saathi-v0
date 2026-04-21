"""
services/ingest_report.py

Four-pass lab report ingestion:
  Pass 1 — Numeric/tabular lab values        → labs{}
  Pass 2 — Descriptive/non-tabular findings  → clinical_notes{}
  Pass 3 — Panel metadata, risk scores       → metadata{}
  Pass 4 — Name normalisation, deduplication → clean labs{}
"""
from __future__ import annotations

import json
import re
from datetime import date

from langsmith import traceable
from llama_parse import LlamaParse
from openai import AsyncOpenAI

from config import settings
from db.client import insert_lab_report
from services.wearable_sync import embed_text

openai = AsyncOpenAI(api_key=settings.openai_api_key)
_parser: LlamaParse | None = None


def get_parser() -> LlamaParse:
    global _parser
    if _parser is None:
        _parser = LlamaParse(
            api_key=settings.llama_cloud_api_key,
            result_type="markdown",
            verbose=False,
            language="en",
            system_prompt=(
                "This is a medical lab report. Extract ALL text with full precision. "
                "Preserve every test name, value, unit, and reference range exactly. "
                "Do NOT skip bullet points, morphology descriptions, impressions, "
                "urine microscopy fields, or any non-tabular text. "
                "Preserve tables as markdown tables."
            ),
        )
    return _parser


NUMERIC_SYSTEM = """You are a precise medical lab data extractor.

Extract EVERY numeric and qualitative test result. Output structured JSON only.

Rules:
- Scan EVERY line. If a line has a test name + number + unit + reference, extract it.
- Include ALL panels: CBC, LFT, KFT, Lipid, Thyroid, Urine (macroscopy AND microscopy),
  Vitamins, Iron, Hormones, Serology, Allergy, Electrolytes, Haematology, and any other panel.
- URINE MICROSCOPY: Extract every field including Transparency, Colour, pH, Specific Gravity,
  Protein, Glucose, Ketones, Blood, Bilirubin, Urobilinogen, Nitrite, Leukocyte Esterase,
  RBC, WBC/Pus Cells, Epithelial Cells, Casts, Crystals, Bacteria, Amorphous Material.
- SINGLE-VALUE TESTS: Extract every numeric test even if it appears alone, not in a table.
- BELOW DETECTION LIMIT: If a value is expressed as "< X" or "> X", store value as that
  exact string (e.g. "< 148"), set flag as "L" for < and "H" for >.
- QUALITATIVE FLAGS:
    "Present (+)" when reference is "Absent" → flag: "Present"
    "Absent" when reference is "Absent"      → flag: "Normal"
    "Negative" result                        → flag: "Negative"
    "Reactive" / "Positive"                  → flag: "Reactive" or "Positive"
- MULTI-CATEGORY REFERENCES: If reference has named tiers (e.g. "Children:>16, Adult:20-50"),
  capture full text in interpretation_bands. Use most applicable tier for reference_range.
- STAGE CLASSIFICATION: Based on interpretation_bands and actual value, determine which named
  stage the value falls into. Store in stage_classification.
  Example: Vit D 8.98, bands Deficiency:<10 → stage_classification: "Deficiency"
  Example: HbA1c 7.1, bands Diabetic:>6.5   → stage_classification: "Diabetic"
- INTERPRETATION TEXT: If a test has a clinical explanation paragraph (Summary, Uses,
  Interpretation sections), capture the FULL text in interpretation_text.
- "0 - 0" in reference_range is a PDF rendering artifact → store as null.
- Output ONLY valid JSON, no markdown fences.

Output format:
{
  "report_date": "YYYY-MM-DD or null",
  "lab_name": "string or null",
  "patient_name": "string or null",
  "patient_age": "string or null",
  "labs": {
    "TestName": {
      "value": "number or string",
      "unit": "string or null",
      "reference_range": "string or null",
      "flag": "H|L|Normal|Contextual|Negative|Positive|Non Reactive|Reactive|Present|Absent|string or null",
      "interpretation_bands": "string or null",
      "stage_classification": "string or null",
      "interpretation_text": "string or null",
      "panel": "CBC|LFT|KFT|Lipid|Thyroid|Urine|Vitamins|Iron|Hormone|Serology|Electrolytes|Immunoassay|Haematology|Other"
    }
  }
}"""


DESCRIPTIVE_SYSTEM = """You are extracting ONLY descriptive, non-tabular clinical findings.
Numeric test results are handled separately — do not duplicate them.

Extract:
1. MORPHOLOGY: Peripheral smear findings, RBC/WBC/platelet observations
2. IMPRESSIONS: Any diagnostic conclusion or impression statement
3. CLINICAL ADVICE: Any Advise/Advice statements
4. PATHOLOGIST COMMENTS: Comment blocks that are not numeric results

If no descriptive findings exist in this chunk, return empty objects.
Output ONLY valid JSON.

Output format:
{
  "clinical_notes": {
    "FindingName": {
      "value": "full descriptive text",
      "unit": null,
      "reference_range": null,
      "flag": null
    }
  },
  "impressions": ["array of diagnostic impression strings"]
}"""


METADATA_SYSTEM = """You are extracting structural metadata from a medical lab report.
Do not extract individual test results.

Extract:
1. PANEL METADATA: For each panel — collection datetime, reporting datetime.
2. RISK SCORES: Any AI/predictive risk model outputs (AICVD, Prediabetes, COPD, etc).
   For each: score, basis, time_horizon, interpretation, acceptable_score.
3. LAB SUMMARY: If a summary section exists with counts of Normal/Abnormal by organ system.
4. VITALS: Height, weight, BMI, BP, pulse, SpO2, temperature, respiration rate.

Output ONLY valid JSON.

Output format:
{
  "panel_metadata": {
    "PanelName": {"collected_at": "string or null", "reported_at": "string or null"}
  },
  "risk_scores": {
    "ModelName": {
      "score": "number or string",
      "basis": "string or null",
      "time_horizon": "string or null",
      "interpretation": "string or null",
      "acceptable_score": "number or string or null"
    }
  },
  "vitals": {
    "MetricName": {"value": "number or string", "unit": "string or null"}
  },
  "lab_summary": {
    "total_parameters": "number or null",
    "normal_count": "number or null",
    "needs_attention_count": "number or null",
    "requires_action_count": "number or null",
    "by_system": {}
  }
}"""


NORMALISE_SYSTEM = """You are a medical terminology normaliser.

Given lab test names and their values, resolve:
1. DUPLICATES — same test with different names, same value, same panel
   e.g. "SGPT" and "ALANINE AMINOTRANSFERASE (ALT/SGPT)" → keep the more descriptive name
2. CONTEXT CONFLICTS — same name in different contexts
   e.g. "RBC" in CBC vs Urine → rename to "RBC Count (CBC)" and "RBC (Urine)"
3. SPELLING VARIANTS — "Haemoglobin" vs "Hemoglobin" → standardise

Rules:
- Only merge if SAME value AND same panel (true duplicates)
- Keep richer/longer name, remove shorter alias
- Do not merge tests with different values
- Output ONLY valid JSON

Output format:
{
  "remove": ["exact_key"],
  "rename": {"exact_old_key": "exact_new_key"},
  "merge": [{"keep": "exact_key_to_keep", "remove": "exact_key_to_remove"}]
}"""


async def _llm(system: str, chunk: str, n: int, total: int) -> dict:
    response = await openai.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": f"Lab report (part {n}/{total}):\n\n{chunk}"},
        ],
    )
    return json.loads(response.choices[0].message.content)


@traceable(name="openai-extract-metrics")
async def extract_structured_metrics(raw_text: str) -> dict:
    CHUNK_SIZE = 20000
    chunks = [raw_text[i:i + CHUNK_SIZE] for i in range(0, len(raw_text), CHUNK_SIZE)]
    total  = len(chunks)

    all_labs:            dict = {}
    all_clinical_notes:  dict = {}
    all_impressions:     list = []
    all_panel_meta:      dict = {}
    all_risk_scores:     dict = {}
    all_vitals:          dict = {}
    lab_summary:         dict = {}
    report_date:   str | None = None
    lab_name:      str | None = None
    patient_name:  str | None = None
    patient_age:   str | None = None

    for i, chunk in enumerate(chunks):
        n = i + 1

        # Pass 1 — numeric
        try:
            r1 = await _llm(NUMERIC_SYSTEM, chunk, n, total)
            for k, v in r1.get("labs", {}).items():
                if k not in all_labs:
                    all_labs[k] = v
                elif isinstance(v, dict) and isinstance(all_labs[k], dict):
                    existing = all_labs[k]
                    # Prefer entry with real reference range over one without
                    if v.get("reference_range") and not existing.get("reference_range"):
                        all_labs[k] = v
                    else:
                        for field in ("interpretation_bands", "stage_classification",
                                      "interpretation_text", "reference_range"):
                            if v.get(field) and not existing.get(field):
                                existing[field] = v[field]
            if not report_date  and r1.get("report_date"):   report_date  = r1["report_date"]
            if not lab_name     and r1.get("lab_name"):      lab_name     = r1["lab_name"]
            if not patient_name and r1.get("patient_name"):  patient_name = r1["patient_name"]
            if not patient_age  and r1.get("patient_age"):   patient_age  = r1["patient_age"]
        except Exception:
            pass

        # Pass 2 — descriptive
        try:
            r2 = await _llm(DESCRIPTIVE_SYSTEM, chunk, n, total)
            for k, v in r2.get("clinical_notes", {}).items():
                if k not in all_clinical_notes:
                    all_clinical_notes[k] = v
            for imp in r2.get("impressions", []):
                if imp and imp not in all_impressions:
                    all_impressions.append(imp)
        except Exception:
            pass

        # Pass 3 — metadata
        try:
            r3 = await _llm(METADATA_SYSTEM, chunk, n, total)
            for k, v in r3.get("panel_metadata", {}).items():
                if k not in all_panel_meta:
                    all_panel_meta[k] = v
            for k, v in r3.get("risk_scores", {}).items():
                if k not in all_risk_scores:
                    all_risk_scores[k] = v
            for k, v in r3.get("vitals", {}).items():
                if k not in all_vitals:
                    all_vitals[k] = v
            if not lab_summary and r3.get("lab_summary", {}).get("total_parameters"):
                lab_summary = r3["lab_summary"]
        except Exception:
            pass

    return {
        "report_date":    report_date,
        "lab_name":       lab_name,
        "patient_name":   patient_name,
        "patient_age":    patient_age,
        "labs":           all_labs,
        "clinical_notes": all_clinical_notes,
        "risk_scores":    all_risk_scores,
        "vitals":         all_vitals,
        "panel_metadata": all_panel_meta,
        "lab_summary":    lab_summary,
        "impressions":    all_impressions,
        "metrics":        all_labs,  # backward compat alias for RAG
    }


def post_process_metrics(structured: dict) -> dict:
    MAX_KEY_LENGTH      = 60
    UPPER_BOUND_RE      = re.compile(r'^[=<≤]+\s*([\d.]+)')
    BELOW_LIMIT_RE      = re.compile(r'^[<>]\s*[\d.]+')
    ZERO_ZERO_RE        = re.compile(r'^0\s*[-–−]\s*0$')
    HIGHER_IS_BETTER_KW = {"ratio", "efficiency", "saturation", "egfr", "hdl"}
    QUALITATIVE_VALUES  = {
        "negative", "positive", "reactive", "non-reactive", "non reactive",
        "detected", "not detected", "absent", "present", "adequate", "normal",
        "borderline", "nil", "trace", "pale yellow", "yellow", "clear",
    }

    labs = structured.get("labs", {})

    for name, data in list(labs.items()):
        if not isinstance(data, dict):
            continue

        value      = data.get("value")
        ref        = (data.get("reference_range") or "").strip()
        name_lower = name.lower()

        # Below-detection-limit — keep LLM flag, skip numeric
        if isinstance(value, str) and BELOW_LIMIT_RE.match(value.strip()):
            if data.get("flag") not in ("H", "L"):
                data["flag"] = "L" if value.strip().startswith("<") else "H"
            continue

        # Qualitative values — flag = the word
        if isinstance(value, str) and value.lower() in QUALITATIVE_VALUES:
            if data.get("flag") in ("H", "L", "Normal"):
                data["flag"] = value.capitalize()
            continue

        # "0 - 0" artifact — null range, keep LLM flag
        if ZERO_ZERO_RE.fullmatch(ref):
            data["reference_range"] = None
            continue

        # Upper-bound-only references
        ub = UPPER_BOUND_RE.match(ref)
        if ub:
            try:
                upper = float(ub.group(1))
                if isinstance(value, (int, float)):
                    data["flag"] = "Normal" if value <= upper else "H"
                    data["reference_range"] = f"<= {upper}"
            except (ValueError, TypeError):
                pass
            continue

        # Recalculate flag from numeric range
        if isinstance(value, (int, float)) and ref:
            m = re.search(r'([\d.]+)\s*[-\u2013\u2212]\s*([\d.]+)', ref)
            if m:
                try:
                    lo, hi = float(m.group(1)), float(m.group(2))
                    data["flag"] = "L" if value < lo else "H" if value > hi else "Normal"
                except (ValueError, TypeError):
                    pass

        # Higher-is-better → Contextual
        if any(kw in name_lower for kw in HIGHER_IS_BETTER_KW):
            if data.get("flag") == "H":
                data["flag"] = "Contextual"

    # Sanitise key lengths
    for section in ("labs", "metrics", "clinical_notes", "risk_scores", "vitals", "panel_metadata"):
        if section in structured and isinstance(structured[section], dict):
            structured[section] = {
                k[:MAX_KEY_LENGTH].strip(): v
                for k, v in structured[section].items()
            }

    return structured


async def normalize_lab_names(structured: dict) -> dict:
    labs = structured.get("labs", {})
    if len(labs) < 3:
        return structured

    try:
        name_value_map = {
            k: {"value": v.get("value"), "panel": v.get("panel")}
            for k, v in labs.items()
            if isinstance(v, dict)
        }
        response = await openai.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": NORMALISE_SYSTEM},
                {"role": "user",   "content": json.dumps(name_value_map, indent=2)},
            ],
        )
        ops = json.loads(response.choices[0].message.content)

        for key in ops.get("remove", []):
            labs.pop(key, None)

        for old, new in ops.get("rename", {}).items():
            if old in labs and new not in labs:
                labs[new] = labs.pop(old)

        for merge_op in ops.get("merge", []):
            keep_key   = merge_op.get("keep")
            remove_key = merge_op.get("remove")
            if keep_key in labs and remove_key in labs:
                keep_e   = labs[keep_key]
                remove_e = labs[remove_key]
                if isinstance(keep_e, dict) and isinstance(remove_e, dict):
                    for field in ("interpretation_bands", "interpretation_text",
                                  "stage_classification", "reference_range"):
                        if not keep_e.get(field) and remove_e.get(field):
                            keep_e[field] = remove_e[field]
                labs.pop(remove_key, None)

        structured["labs"]    = labs
        structured["metrics"] = labs

    except Exception:
        pass

    return structured


def build_report_embedding_text(structured: dict, raw_text: str) -> str:
    parts = []
    if structured.get("report_date"):  parts.append(f"Lab report dated {structured['report_date']}.")
    if structured.get("lab_name"):     parts.append(f"Lab: {structured['lab_name']}.")
    if structured.get("patient_name"): parts.append(f"Patient: {structured['patient_name']}.")

    for name, data in structured.get("labs", {}).items():
        if not isinstance(data, dict):
            continue
        val       = data.get("value", "")
        unit      = data.get("unit") or ""
        flag      = data.get("flag") or ""
        stage     = data.get("stage_classification") or ""
        flag_str  = f" ({flag})"  if flag  and flag  not in ("Normal", "") else ""
        stage_str = f" [{stage}]" if stage else ""
        parts.append(f"{name}: {val} {unit}{flag_str}{stage_str}.")

    for imp in structured.get("impressions", []):
        parts.append(f"Clinical impression: {imp}.")

    for name, data in structured.get("risk_scores", {}).items():
        if isinstance(data, dict):
            parts.append(
                f"Risk score {name}: {data.get('score')} "
                f"(acceptable: {data.get('acceptable_score', 'N/A')}) — "
                f"{data.get('interpretation', '')}."
            )

    parts.append(f"Report excerpt: {raw_text[:500]}")
    return " ".join(parts)


@traceable(name="ingest-lab-report")
async def ingest_lab_report(
    user_id: str,
    file_bytes: bytes,
    file_name: str,
    source: str = "upload",
) -> dict:
    parser    = get_parser()
    documents = await parser.aload_data(file_bytes, extra_info={"file_name": file_name})
    if not documents:
        return {"success": False, "error": "Could not extract text. Upload a clearer image or typed PDF."}
    raw_text = "\n\n".join(doc.text for doc in documents)
    if not raw_text.strip():
        return {"success": False, "error": "Could not extract text. Upload a clearer image or typed PDF."}

    structured = await extract_structured_metrics(raw_text)   # passes 1-3
    structured = post_process_metrics(structured)              # flag correction
    structured = await normalize_lab_names(structured)        # pass 4

    report_date = None
    if structured.get("report_date"):
        try:
            report_date = date.fromisoformat(structured["report_date"])
        except ValueError:
            pass

    embed_str = build_report_embedding_text(structured, raw_text)
    embedding = await embed_text(embed_str)

    record = await insert_lab_report(
        user_id=user_id,
        raw_text=raw_text,
        structured_data=structured,
        embedding=embedding,
        report_date=report_date,
        lab_name=structured.get("lab_name"),
        file_name=file_name,
        source=source,
    )

    return {
        "success":           True,
        "report_id":         record["id"],
        "metrics_extracted": list(structured.get("labs", {}).keys()),
        "clinical_notes":    list(structured.get("clinical_notes", {}).keys()),
        "risk_scores":       list(structured.get("risk_scores", {}).keys()),
        "impressions":       structured.get("impressions", []),
        "report_date":       structured.get("report_date"),
        "lab_name":          structured.get("lab_name"),
        "patient_name":      structured.get("patient_name"),
    }

# Saathi — Engineering Improvements Log

---

## Lab Report Ingestion

### Chunked Extraction
- **Problem:** `[:12000]` char slice silently dropped pages 4–21 of multi-page reports
- **Fix:** Chunked extraction at 20,000 chars per chunk, merged across all chunks
- **Impact:** Coverage from ~25% to ~93%

### Two-Pass Extraction
- **Problem:** Single prompt could not reliably extract both numeric/tabular data and descriptive non-tabular text (peripheral smear, impressions)
- **Fix:** Pass 1 — numeric/tabular only. Pass 2 — descriptive/morphology only. Results merged without overwrite
- **Impact:** Peripheral smear, impressions, and clinical advice now captured

### Flag Recalculation via Regex
- **Problem:** LLM flag direction errors (e.g. RDW 20.8 flagged L vs range 11.5–14.5)
- **Fix:** Post-processor recalculates every numeric flag from actual value vs reference range using `re.search(r'([\d.]+)\s*[-–−]\s*([\d.]+)')` — no hardcoded metric names
- **Impact:** All numeric flags verified against actual reference ranges

### Upper-Bound-Only Reference Handling
- **Problem:** References like `"= 171"` or `"<= 5.0"` caused values below threshold to be flagged L
- **Fix:** `UPPER_BOUND_PATTERNS = re.compile(r'^[=<≤]+\s*([\d.]+)')` detects and recalculates correctly
- **Impact:** CPK, qualitative thresholds now correct

### Qualitative Flag Correction
- **Problem:** Qualitative results (HBsAg = Negative, Allergy Screen = Negative) flagged as L
- **Fix:** `QUALITATIVE_VALUES` set — if value is a qualitative word, flag is set to the value itself, not H/L
- **Impact:** All negative/positive/reactive tests flagged correctly

### Higher-is-Better Detection
- **Problem:** Ratios and efficiency metrics (HDL/LDL, eGFR, Transferrin Saturation) flagged H when above range
- **Fix:** `HIGHER_IS_BETTER_KEYWORDS = {"ratio", "efficiency", "saturation", "egfr", "hdl"}` — detected by name pattern, not hardcoded names. Flag set to `Contextual`
- **Impact:** Avoids false-positive high flags on beneficial metrics

### Key Length Sanitisation
- **Problem:** Postgres truncates JSONB keys over 60 chars, causing silent data loss
- **Fix:** All keys capped at 60 chars before insert
- **Impact:** No more truncated field names (e.g. Transferrin Saturation)

### Structured Schema (labs / vitals / risk_scores / clinical_notes)
- **Problem:** Flat `metrics` object mixed raw lab values, risk model outputs, clinical notes
- **Fix:** Extraction output schema split into `labs`, `vitals`, `risk_scores`, `clinical_notes`, `panel_metadata`, `impressions`
- **Impact:** Enables panel-level grouping, risk score separation, and structured RAG retrieval

### Interpretation Bands
- **Problem:** Named category tables (HbA1c diabetic/pre-diabetic, hs-CRP risk tiers) not captured
- **Fix:** `interpretation_bands` field added to extraction schema; chunk merge carries bands forward if missed in earlier chunk
- **Impact:** Downstream RAG can reference clinical classification bands

### Stage Classification

- **Problem**: Interpretation bands captured as text but actual stage the patient falls into (e.g. "Deficiency" for Vit D 8.98 vs <10) not derived
- **Fix**: stage_classification field added to extraction schema — LLM determines which named tier the value falls into based on bands
- **Impact**: Chat and brief can reference "your Vitamin D is in the Deficiency stage" instead of raw number

### Clinical Interpretation Text

- **Problem**: Per-test clinical explanation paragraphs (Vitamin D, B12, Homocysteine, PSA, IgE) discarded during extraction
- **Fix**: interpretation_text field added — LLM captures the full explanation block for each test if present
- **Impact**: RAG retrieval has richer context for nuanced queries about what a test means clinically

### Below-Detection-Limit Values

- **Problem**: Values like "< 148" (Vitamin B12) caused numeric flag recalculation to break or skip the metric
- **Fix**: re.match(r'^<\s*[\d.]+', value) detects below-limit strings before qualitative/numeric processing. Flag set to L, skips all numeric logic
- **Impact**: Correctly handles undetectable/below-limit results across any lab format

### Lab Name Normalisation (4th pass)

- **Problem**: Same test extracted under different names across labs and even within one report — "SGPT" vs "ALT/SGPT" vs "Alanine Aminotransferase", "Haemoglobin" vs "Hemoglobin", "RBC" conflated across CBC and urine panels
- **Fix**: 4th LLM pass using gpt-4o-mini — detects duplicates (same value, same panel), renames context conflicts (e.g. "RBC (Urine)" vs "RBC Count (CBC)"), merges richer fields from the dropped entry before removal
- **Impact**: Clean deduplicated lab dict; no duplicate entries in RAG retrieval or brief generation

### Qualitative Abnormal Flag

- **Problem**: "Present (+)" (e.g. Urine Glucose) stored as qualitative Normal — missed as abnormal finding
- **Fix**: Flag set to "Present" when value is Present and reference is Absent; "Normal" only when both match
- **Impact**: Abnormal urine findings correctly surfaced in chat and digest

---

## Guardrails

### spaCy + LLM Two-Stage Guard
- **Problem:** Hardcoded keyword list fragile — missed nuanced phrasing, caused false positives
- **Fix:** Stage 1 spaCy linguistic analysis (subject-verb-object patterns). Stage 2 GPT-4o-mini classifier
- **Impact:** Blocks medical advice queries without blocking legitimate data retrieval

### Anti-Sycophancy Layer
- **Problem:** RLHF-trained models tend to agree with user pushback even when data contradicts it
- **Fix:** GPT-4o-mini detects when user is pressuring model to change a data-based answer. Injects reinforcement note into RAG system prompt
- **Impact:** Model re-cites source data rather than softening answer under pressure

---

## Infrastructure

### FK Constraint Removal for POC
- **Problem:** Supabase foreign key on `user_id` rejected hardcoded POC UUID not present in `auth.users`
- **Fix:** Dropped FK constraints on all three tables for Phase 0. Restore with real auth in Phase 1

### CORS Fix
- **Problem:** `allow_credentials=True` + `allow_origins=["*"]` is an invalid combination, caused 400 on OPTIONS preflight
- **Fix:** Set `allow_credentials=False` with `allow_origins=["*"]` for POC

### Upstash Cache Bypass
- **Problem:** Expired Upstash Redis instance caused all dashboard data fetches to 500
- **Fix:** `getCachedMetrics` returns `null`, `setCachedMetrics` returns early — bypasses Redis for local dev
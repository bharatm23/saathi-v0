# Gaps: Apollo Report vs structured_data (Supabase)

## Coverage
- Structured lab metrics: ~98%
- Overall report completeness: ~95–96%

---

## Missing Data

### 1. Lab Summary (Page 3)
- Organ-system grouping (Blood, Endocrine, Cardiac, Renal, etc.)
- Counts by status: Normal / Needs Attention / Requires Action

### 2. “Parameters Needing Attention” (Page 4)
- Grouped abnormal parameters
- Associated clinical descriptions for each flagged metric

### 3. Urine Panel (Page 6)
Missing fields:
- Transparency
- Nitrite
- Leukocyte Esterase
- Pus Cells
- Epithelial Cells

### 4. CBC Extension
- Corrected TLC

### 5. Panel Metadata
- “Sample Collected On” (per panel)
- Panel grouping (CBC, LFT, KFT, Lipid, Thyroid)

---

## Missing Clinical Context

### 1. Parameter Descriptions
- HbA1c, Urea, Triglycerides, Vitamin D, LFT explanations

### 2. Interpretation Bands
- HbA1c classification (Normal / Prediabetic / Diabetic)
- Lipid risk categories
- BMI classification

---

## Missing Risk Model Structure

### 1. AI Risk Scores (Page 11)
Incomplete structure:
- Model descriptions (AICVD, Prediabetes, COPD)
- Basis (inputs used)
- Accuracy statements
- Time horizon (e.g., COPD 3-month risk)

### 2. Risk Interpretation
- “Your score vs acceptable score” comparison
- Narrative explanations

---

## Schema Gaps

### 1. Flat Structure
- No separation of:
  - labs
  - vitals
  - risk_scores
  - clinical_notes

### 2. Mixed Data Types
- Metrics, risk scores, and clinical notes stored under a single `metrics` object

---

## Summary

- Missing primarily:
  - Summary layers
  - Clinical explanations
  - Risk model context
  - Panel-level structure

- structured_data is complete for raw values but lacks:
  - interpretability
  - grouping
  - clinical intelligence
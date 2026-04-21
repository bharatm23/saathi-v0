export const appointmentTypes = [
  "General check-up",
  "Cardiology",
  "Endocrinology",
  "Specialist follow-up",
  "Lab review",
  "Other",
];

// TODO: POST /api/brief { type } → markdown string
export const mockBrief = `## Why this visit
Cardiology consult — reviewing borderline LDL and recent wearable trends for **Priya** (prepared 19 Apr 2026).

## Key values
- Total cholesterol **196 mg/dL** (28 Feb)
- LDL **128 mg/dL** — flagged borderline (28 Feb)
- HDL **48 mg/dL** (28 Feb)
- Resting HR **72 bpm**, 28-day avg

> [!positive] LDL improving
> LDL dropped from 142 mg/dL (Jan) to 128 mg/dL (Feb) — a 10% reduction over 8 weeks.

## Recent trends
- Sleep averaging **7h 12min** over 28 days, up from 6h 48min previous month
- Steps 8,241/day average — consistent
- HRV stable with slight upward trend

> [!caution] Watch
> LDL is still above the target range of 100 mg/dL. Worth discussing whether lifestyle is sufficient or if additional intervention is indicated.

## Questions to ask
1. Is current lifestyle-only approach still appropriate given the trend?
2. Should we recheck the lipid panel in 8 weeks or wait 12?
3. Any reason to add a second HDL-focused marker next time?
`;

// TODO: fetch /api/digest?period=7|14|30
export const mockDigest = (period: 7 | 14 | 30) => `## This week
Your last ${period} days look steady. Most markers within your personal baseline; one flagged for attention.

> [!positive] Improving
> - LDL trending down: 142 → 128 mg/dL across the last 3 panels
> - Average sleep up 32 minutes per night
> - Resting HR down 4 bpm vs. previous ${period} days

> [!caution] Watch
> - LDL still above your target of 100 mg/dL
> - Sleep variance slightly higher this week — 3 nights under 6h

## Context
Based on **3 lab reports** and **${period} days of wearable data**. Your next lipid panel is scheduled for mid-May.`;

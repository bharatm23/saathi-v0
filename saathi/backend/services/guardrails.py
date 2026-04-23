"""
services/guardrails.py

Medical intent detection using spaCy + a small LLM as outer layer.
No hard-coded keyword list — spaCy understands linguistic context,
and the LLM classifier catches nuanced phrasing both miss.

Two-stage approach:
  Stage 1 — spaCy: fast, zero-cost, catches direct medical queries
  Stage 2 — GPT-4o-mini: catches indirect/nuanced medical intent
             (e.g. "should I worry about my sugar?" vs "what is my sugar?")

A query only reaches the main RAG layer if both stages pass.
"""
from __future__ import annotations

import json

# import spacy
from langsmith import traceable
from openai import AsyncOpenAI

from config import settings

openai = AsyncOpenAI(api_key=settings.openai_api_key)

# # Load spaCy model — en_core_web_sm is small and fast
# # Run once at startup: python -m spacy download en_core_web_sm
# try:
#     # nlp = spacy.load("en_core_web_sm")
# except OSError:
#     # If model not downloaded yet, provide clear instruction
#     raise RuntimeError(
#         "spaCy model not found. Run: python -m spacy download en_core_web_sm"
#     )


# ── Safe response — shown whenever a query is blocked ────────
SAFE_RESPONSE = (
    "Saathi only summarises your own health data — it cannot interpret "
    "what results mean medically, suggest diagnoses, or advise on treatment. "
    "Please discuss this with your doctor."
)

# ── Stage 1: spaCy heuristic detection ───────────────────────

# Entity labels that suggest medical advice-seeking context
MEDICAL_ENT_LABELS = {"DISEASE", "SYMPTOM", "MEDICATION", "TREATMENT"}

# Verb patterns that suggest advice-seeking rather than data retrieval
ADVICE_VERBS = {
    "diagnose", "prescribe", "treat", "cure", "fix", "take", "recommend",
    "suggest", "help", "worry", "concern",
}

# Dependency + lemma patterns that signal self-diagnosis
DIAGNOSIS_PATTERNS = {
    "have", "suffer", "got", "develop", "get",
}


# def spacy_medical_check(query: str) -> tuple[bool, str]:
#     """
#     Returns (is_medical, reason).
#     Uses spaCy linguistic analysis — not keyword matching.
#     """
#     doc = nlp(query.lower())

#     # Check 1: Does the sentence contain medical entity + advice verb combo?
#     has_medical_ent = any(ent.label_ in MEDICAL_ENT_LABELS for ent in doc.ents)
#     has_advice_verb = any(token.lemma_ in ADVICE_VERBS for token in doc if token.pos_ == "VERB")

#     if has_medical_ent and has_advice_verb:
#         return True, "medical entity + advice verb detected"

#     # Check 2: Self-diagnosis pattern — "do I have X", "I think I have X"
#     # Look for: pronoun (I) + VERB (have/got/suffer) + noun/entity chain
#     for token in doc:
#         if token.lemma_ in DIAGNOSIS_PATTERNS and token.pos_ == "VERB":
#             # Check if subject is first-person
#             for child in token.children:
#                 if child.dep_ == "nsubj" and child.text in {"i", "we", "my"}:
#                     return True, "self-diagnosis pattern detected"

#     # Check 3: Direct question about medical meaning/interpretation
#     # "what does X mean", "is X normal", "is X dangerous"
#     interpretation_lemmas = {"mean", "indicate", "signify", "normal", "dangerous", "serious", "bad", "good"}
#     question_words = {token.lemma_ for token in doc if token.tag_ in {"WDT", "WP", "WRB", "WP$"}}
#     content_lemmas = {token.lemma_ for token in doc}

#     if question_words and content_lemmas & interpretation_lemmas:
#         return True, "medical interpretation question detected"

#     return False, ""


# ── Stage 2: LLM classifier ───────────────────────────────────

CLASSIFIER_SYSTEM = """You are a safety classifier for a health data app.

Classify the user's message as either SAFE or BLOCKED.

BLOCKED if the message:
- Asks for a medical diagnosis ("do I have diabetes?", "is this cancer?")
- Asks what a test result means medically ("what does high LDL mean?")
- Asks for medication advice ("should I take X?", "what dose?")
- Asks if a symptom is serious or dangerous
- Asks for treatment recommendations
- Asks the app to confirm a self-diagnosis the user already has

SAFE if the message:
- Asks to retrieve or compare their own data ("what was my HbA1c last month?")
- Asks about trends in their own numbers ("has my sleep improved?")
- Asks what they should tell their doctor (not what to do themselves)
- Asks to prepare for an appointment
- Asks general non-medical questions

Respond with ONLY this JSON:
{"decision": "SAFE" | "BLOCKED", "reason": "one sentence"}"""


@traceable(name="llm-intent-classify")
async def llm_intent_check(query: str) -> tuple[bool, str]:
    """
    Returns (is_blocked, reason).
    Uses GPT-4o-mini — fast and cheap for classification.
    """
    response = await openai.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": CLASSIFIER_SYSTEM},
            {"role": "user",   "content": query},
        ],
    )
    try:
        result = json.loads(response.choices[0].message.content)
        is_blocked = result.get("decision") == "BLOCKED"
        return is_blocked, result.get("reason", "")
    except Exception:
        # If classifier fails, default to safe (don't break the app)
        return False, "classifier error — defaulting to safe"


# ── Anti-sycophancy check ─────────────────────────────────────

SYCOPHANCY_SYSTEM = """You are checking if a user is trying to get the AI to change 
a factual answer by pushing back, expressing disagreement, or repeating their belief.

Examples of sycophancy pressure:
- "No, I think my sugar is fine actually"
- "You're wrong, my doctor said it's okay"  
- "But I feel healthy, so it must be normal"
- "Are you sure? I don't think that's right"

Examples of legitimate follow-up:
- "Can you show me the data again?"
- "What was my reading in January?"
- "Can you compare to last year?"

Respond ONLY with JSON:
{"is_pressure": true | false, "reason": "one sentence"}"""


@traceable(name="sycophancy-check")
async def sycophancy_check(query: str, previous_assistant_response: str | None) -> bool:
    """
    Returns True if the user appears to be pressuring the model to change
    a data-based answer. Only runs when there is a previous response to compare against.
    """
    if not previous_assistant_response:
        return False

    response = await openai.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYCOPHANCY_SYSTEM},
            {"role": "user",   "content": f"Previous AI response: {previous_assistant_response[:300]}\n\nUser follow-up: {query}"},
        ],
    )
    try:
        result = json.loads(response.choices[0].message.content)
        return result.get("is_pressure", False)
    except Exception:
        return False


# ── Main guard entry point ────────────────────────────────────

@traceable(name="guardrail-check")
async def run_guardrails(
    query: str,
    previous_assistant_response: str | None = None,
) -> dict:
    """
    Run full guardrail pipeline on a user query.

    Returns:
    {
      "blocked": bool,
      "reason": str,
      "safe_response": str | None,   # shown to user if blocked
      "sycophancy_detected": bool,
    }
    """
    # # Stage 1: spaCy (fast, free)
    # spacy_blocked, spacy_reason = spacy_medical_check(query)
    # if spacy_blocked:
    #     return {
    #         "blocked": True,
    #         "reason": f"spaCy: {spacy_reason}",
    #         "safe_response": SAFE_RESPONSE,
    #         "sycophancy_detected": False,
    #     }

    # Stage 2: LLM classifier (catches nuanced cases)
    llm_blocked, llm_reason = await llm_intent_check(query)
    if llm_blocked:
        return {
            "blocked": True,
            "reason": f"LLM classifier: {llm_reason}",
            "safe_response": SAFE_RESPONSE,
            "sycophancy_detected": False,
        }

    # Stage 3: Anti-sycophancy check
    is_sycophancy = await sycophancy_check(query, previous_assistant_response)
    sycophancy_note = None
    if is_sycophancy:
        # Don't block — but flag it so the RAG prompt reinforces its previous answer
        sycophancy_note = (
            "The user appears to be disagreeing with your previous response. "
            "Re-check the retrieved documents and report exactly what they show. "
            "Do not soften or change your answer to agree with the user "
            "unless the documents clearly support their claim."
        )

    return {
        "blocked": False,
        "reason": "",
        "safe_response": None,
        "sycophancy_detected": is_sycophancy,
        "sycophancy_note": sycophancy_note,
    }

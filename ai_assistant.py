"""
TriageWolf AI assistant.

Wraps OpenAI to translate free-text or voice-transcribed symptom descriptions
into structured CTAS-aligned triage data, plus an "early detection" flag for
serious conditions the patient might not realize they're describing.

Also detects "outbreak signals" (multiple people sick, unusual symptom clusters)
which the app uses to auto-activate Condition X surge mode.
"""

import json
import os
from dotenv import load_dotenv

load_dotenv()  # picks up OPENAI_API_KEY from .env

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None  # graceful fallback if SDK missing

_client = None


def get_client():
    global _client
    if _client is not None:
        return _client
    if OpenAI is None:
        return None
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None
    _client = OpenAI(api_key=api_key)
    return _client


SYSTEM_PROMPT = """You are TriageWolf, an AI medical triage assistant for Brampton, Ontario.
You analyze a patient's free-text symptom description and return STRICT JSON only.

Our symptom catalogue (match user descriptions to these EXACT strings):
CRITICAL: "Chest pain", "Difficulty breathing", "Severe bleeding", "Stroke signs (face drooping, slurred speech)", "Unconscious or unresponsive"
URGENT: "High fever (over 39C)", "Suspected broken bone", "Deep cut needing stitches", "Severe abdominal pain", "Persistent vomiting"
MODERATE: "Moderate fever", "Sprain or strain", "Ear infection", "UTI symptoms", "Persistent cough"
MILD: "Cold symptoms", "Mild headache", "Minor cut", "Sore throat", "Rash"

Return a JSON object with EXACTLY these fields:
{
  "matched_symptoms": [array of strings copied verbatim from the catalogue above],
  "severity_tier": one of "critical" | "urgent" | "moderate" | "mild",
  "early_warning": null OR a short sentence flagging a serious condition the patient may not realize they're describing (e.g. "Symptoms could indicate a heart attack — go to the ER now"),
  "outbreak_signal": true if the description suggests an outbreak (multiple people sick, "everyone at school/work", unusual cluster, public-health emergency keywords) else false,
  "outbreak_reason": short string explaining why outbreak_signal is true, or null,
  "summary": one short empathetic sentence acknowledging what they described,
  "next_steps": one short actionable recommendation (e.g. "Go to Brampton Civic Hospital ER now")
}

RULES:
- When uncertain, escalate severity (patient safety first).
- Heart-attack pattern (chest discomfort + arm/jaw pain + sweating/nausea) → set early_warning, severity_tier="critical".
- Stroke pattern (sudden facial droop, slurred speech, one-sided weakness) → critical + early_warning.
- Sepsis pattern (high fever + confusion + rapid breathing) → critical + early_warning.
- "Many people sick", "outbreak", "everyone in my class/family has it", "spreading fast" → outbreak_signal=true.
- Never include any field not listed above. No prose outside JSON.
"""


def analyze_symptoms(user_text: str) -> dict:
    """
    Returns a dict with the structured triage analysis, or {"error": "..."} on failure.
    """
    client = get_client()
    if client is None:
        return {
            "error": "AI assistant not configured. Set OPENAI_API_KEY in your environment or .env file.",
        }

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            temperature=0.2,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_text},
            ],
        )
        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)
    except Exception as e:
        return {"error": f"AI request failed: {e}"}

    # Defensive defaults so the frontend never crashes on a malformed model response.
    data.setdefault("matched_symptoms", [])
    data.setdefault("severity_tier", "mild")
    data.setdefault("early_warning", None)
    data.setdefault("outbreak_signal", False)
    data.setdefault("outbreak_reason", None)
    data.setdefault("summary", "")
    data.setdefault("next_steps", "")
    return data

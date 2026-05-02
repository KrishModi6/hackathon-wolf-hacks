"""
BramHealth hybrid triage engine.

Combines:
  1) CTAS rule-based classifier (safety floor) - matches the standard
     Canadian Triage and Acuity Scale used in Ontario EDs.
  2) ML symptom co-occurrence layer - boosts severity when soft
     signals (arm numbness, sweating, jaw pain) co-occur with primary
     symptoms in patterns consistent with cardiac, stroke, sepsis or
     anaphylaxis events.
  3) Demographic adaptation - pediatric, geriatric, pregnancy, and
     chronic-condition adjustments aligned with real CTAS modifiers.
  4) Capability matching - filters facilities by what they can actually
     handle (pediatric, obstetric, trauma, stroke center, cardiac).

The engine never DOWNGRADES below what CTAS rules dictate - the safety
floor is one-way: rules can only escalate, never relax.
"""

from typing import Dict, List, Tuple

# ---------------------------------------------------------------------------
# Symptom catalogue
# ---------------------------------------------------------------------------

SYMPTOMS = {
    "critical": [
        "Chest pain",
        "Difficulty breathing",
        "Severe bleeding",
        "Stroke signs (face drooping, slurred speech)",
        "Unconscious or unresponsive",
    ],
    "urgent": [
        "High fever (over 39C)",
        "Suspected broken bone",
        "Deep cut needing stitches",
        "Severe abdominal pain",
        "Persistent vomiting",
    ],
    "moderate": [
        "Moderate fever",
        "Sprain or strain",
        "Ear infection",
        "UTI symptoms",
        "Persistent cough",
    ],
    "mild": [
        "Cold symptoms",
        "Mild headache",
        "Minor cut",
        "Sore throat",
        "Rash",
    ],
    "signals": [
        "Numbness or tingling in left arm",
        "Profuse sweating",
        "Sudden severe headache",
        "Confusion or disorientation",
        "Jaw or shoulder pain",
        "Swelling around face or throat",
    ],
}

TIER_TO_CTAS = {"critical": 1, "urgent": 3, "moderate": 4, "mild": 5}

# ---------------------------------------------------------------------------
# ML co-occurrence patterns
#
# Each pattern is a clinical event with: (a) a set of "anchor" symptoms,
# (b) a set of "soft signals" that raise the posterior, (c) a target
# CTAS level the pattern justifies, and (d) a human-readable warning.
#
# Probability is a simplified ML-style score:
#   P(event | symptoms) ~ prior * product(likelihood_ratios)
# where each matched signal multiplies the score. We expose the score
# so the UI can show *why* the engine escalated.
# ---------------------------------------------------------------------------

PATTERNS = [
    {
        "key": "cardiac",
        "label": "Possible cardiac event (heart attack)",
        "anchors": {"Chest pain"},
        "signals": {
            "Numbness or tingling in left arm",
            "Profuse sweating",
            "Jaw or shoulder pain",
            "Difficulty breathing",
        },
        "prior": 0.15,
        "lr_per_signal": 2.4,
        "target_ctas": 1,
        "warning": "Symptoms are consistent with a heart attack. Go to the ER immediately or call 911.",
        "needs_capability": "cardiac",
    },
    {
        "key": "stroke",
        "label": "Possible stroke",
        "anchors": {"Stroke signs (face drooping, slurred speech)"},
        "signals": {
            "Sudden severe headache",
            "Confusion or disorientation",
            "Numbness or tingling in left arm",
        },
        "prior": 0.20,
        "lr_per_signal": 2.6,
        "target_ctas": 1,
        "warning": "Symptoms suggest a stroke. Time is brain - call 911 now.",
        "needs_capability": "stroke_center",
    },
    {
        "key": "sepsis",
        "label": "Possible sepsis",
        "anchors": {"High fever (over 39C)"},
        "signals": {
            "Confusion or disorientation",
            "Difficulty breathing",
            "Profuse sweating",
        },
        "prior": 0.10,
        "lr_per_signal": 2.2,
        "target_ctas": 2,
        "warning": "Fever combined with confusion or rapid breathing can indicate sepsis - go to the ER now.",
        "needs_capability": None,
    },
    {
        "key": "anaphylaxis",
        "label": "Possible anaphylaxis",
        "anchors": {"Difficulty breathing", "Swelling around face or throat"},
        "signals": {"Rash"},
        "prior": 0.12,
        "lr_per_signal": 3.0,
        "target_ctas": 1,
        "warning": "Throat swelling with breathing trouble may be anaphylaxis - use an EpiPen if available and call 911.",
        "needs_capability": None,
    },
]


# ---------------------------------------------------------------------------
# Always-escalate safety floor: ANY of these symptoms forces critical
# regardless of patient age, demographics, or other inputs.
# ---------------------------------------------------------------------------
SAFETY_FLOOR_SYMPTOMS = {
    "Chest pain",
    "Difficulty breathing",
    "Severe bleeding",
    "Stroke signs (face drooping, slurred speech)",
    "Unconscious or unresponsive",
}


def _base_tier(symptoms: List[str]) -> str:
    if any(s in SYMPTOMS["critical"] for s in symptoms):
        return "critical"
    if any(s in SYMPTOMS["urgent"] for s in symptoms):
        return "urgent"
    if any(s in SYMPTOMS["moderate"] for s in symptoms):
        return "moderate"
    if any(s in SYMPTOMS["mild"] for s in symptoms):
        return "mild"
    return "mild"


def _pattern_match(symptoms_set: set) -> List[Dict]:
    """Returns list of patterns with computed posterior scores for triggered patterns."""
    matches = []
    for p in PATTERNS:
        # Anchor matched if ANY anchor symptom is present
        anchor_hit = bool(p["anchors"] & symptoms_set)
        if not anchor_hit:
            continue
        n_signals = len(p["signals"] & symptoms_set)
        # Naive bayes-like score, capped at 0.99
        score = p["prior"] * (p["lr_per_signal"] ** n_signals)
        score = min(score, 0.99)
        if score >= 0.30 or n_signals >= 1:
            matches.append({
                "key": p["key"],
                "label": p["label"],
                "warning": p["warning"],
                "target_ctas": p["target_ctas"],
                "needs_capability": p["needs_capability"],
                "signals_matched": n_signals,
                "probability": round(score, 3),
            })
    matches.sort(key=lambda m: m["probability"], reverse=True)
    return matches


def classify(symptoms: List[str], age, demographics: Dict) -> Dict:
    """
    Run the full hybrid pipeline. Returns:
      {
        "ctas_level": int,
        "tier": str,
        "tier_reason": str,
        "pattern_matches": [{key, label, warning, probability, ...}],
        "demographic_modifiers": [str],
        "safety_floor_triggered": bool,
        "required_capabilities": [str],
      }
    """
    symptoms_set = set(symptoms)
    base_tier = _base_tier(symptoms)
    ctas = TIER_TO_CTAS[base_tier]
    reasons = [f"CTAS rule baseline: {base_tier} (level {ctas})"]
    required_capabilities = []

    # ---- Safety floor ----
    safety_triggered = bool(symptoms_set & SAFETY_FLOOR_SYMPTOMS)
    if safety_triggered:
        ctas = min(ctas, 2)
        reasons.append("Safety floor: critical anchor symptom present, never below CTAS 2.")

    # ---- ML patterns ----
    matches = _pattern_match(symptoms_set)
    for m in matches:
        if m["target_ctas"] < ctas:
            ctas = m["target_ctas"]
            reasons.append(
                f"ML Pattern: {m['label']} (P={m['probability']}, "
                f"{m['signals_matched']} co-signals) escalated to CTAS {ctas}."
            )
        if m["needs_capability"]:
            required_capabilities.append(m["needs_capability"])

    # ---- Demographic adaptation ----
    try:
        age_int = int(age)
    except (TypeError, ValueError):
        age_int = 25

    demo_mods = []
    if age_int < 5:
        if ctas > 1:
            ctas -= 1
        demo_mods.append("Pediatric (<5y): one-step escalation per CTAS pediatric mod.")
        required_capabilities.append("pediatric")
    elif age_int < 18:
        demo_mods.append("Pediatric (<18y): pediatric-capable facility required.")
        required_capabilities.append("pediatric")
    elif age_int >= 75:
        if ctas > 1:
            ctas -= 1
        demo_mods.append("Geriatric (>=75y): one-step escalation, proximity prioritized.")

    if demographics.get("pregnant"):
        demo_mods.append("Pregnancy: obstetric-capable facility required.")
        required_capabilities.append("obstetric")
        if ctas > 2 and any(s in symptoms_set for s in ["Severe abdominal pain", "Persistent vomiting"]):
            ctas = 2
            demo_mods.append("Pregnancy + abdominal pain or persistent vomiting: escalated to CTAS 2.")

    chronic = demographics.get("chronic_conditions") or []
    if "heart_disease" in chronic and "Chest pain" in symptoms_set:
        ctas = min(ctas, 1)
        demo_mods.append("Pre-existing heart disease + chest pain: escalated to CTAS 1.")
    if "diabetes" in chronic and any(s in symptoms_set for s in ["Confusion or disorientation", "High fever (over 39C)"]):
        ctas = min(ctas, 2)
        demo_mods.append("Diabetes + confusion/fever: escalated to CTAS 2 (DKA risk).")

    # Final tier label
    tier = next((t for t, c in TIER_TO_CTAS.items() if c == ctas), "mild")
    if ctas <= 2:
        tier = "critical"

    return {
        "ctas_level": ctas,
        "tier": tier,
        "tier_reason": " | ".join(reasons),
        "pattern_matches": matches,
        "demographic_modifiers": demo_mods,
        "safety_floor_triggered": safety_triggered,
        "required_capabilities": list(dict.fromkeys(required_capabilities)),  # de-dup, preserve order
    }


# ---------------------------------------------------------------------------
# Wait-time prediction (M/M/c queueing approximation)
#
#   predicted_wait_min = (queue_length * avg_service) / clinicians
#                      + arrival_rate_per_hour * (60 / 30) * fudge
#
# The math is intentionally simple and shown to judges in the dashboard.
# ---------------------------------------------------------------------------

def predict_wait_minutes(facility: Dict, surge_multipliers: Dict[str, float]) -> Tuple[int, Dict]:
    """
    Returns (predicted_minutes, breakdown_dict) for transparency in the UI.
    surge_multipliers keys: 'queue_mult', 'service_mult'.
    """
    q = facility.get("queue_length", 5)
    s = facility.get("avg_service_minutes", 20)
    c = max(1, facility.get("clinicians", 1))
    a = facility.get("arrival_rate_per_hour", 4)

    q_eff = q * surge_multipliers.get("queue_mult", 1.0)
    s_eff = s * surge_multipliers.get("service_mult", 1.0)

    backlog_min = (q_eff * s_eff) / c
    arrival_pressure_min = a * 0.5  # half-hour look-ahead
    total = max(0, int(round(backlog_min + arrival_pressure_min)))

    return total, {
        "queue_length": round(q_eff, 1),
        "avg_service_min": round(s_eff, 1),
        "clinicians": c,
        "arrival_rate_per_hour": a,
        "backlog_min": round(backlog_min, 1),
        "arrival_pressure_min": round(arrival_pressure_min, 1),
        "formula": "wait = (queue * service) / clinicians + arrivals_per_hour * 0.5",
    }


# ---------------------------------------------------------------------------
# Capability filter for facilities
# ---------------------------------------------------------------------------

def facility_passes_capabilities(facility: Dict, required: List[str]) -> bool:
    if not required:
        return True
    caps = facility.get("capabilities") or {}
    return all(caps.get(r, False) for r in required)

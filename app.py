"""
TriageWolf - Brampton's Smart Healthcare Navigator
Built for WolfHacks 2026

Triage logic is based on CTAS (Canadian Triage and Acuity Scale), the standard
5-level acuity scale used by Canadian emergency departments:
  Level 1: Resuscitation (immediate)
  Level 2: Emergent (<= 15 min)
  Level 3: Urgent (<= 30 min)
  Level 4: Less Urgent (<= 60 min)
  Level 5: Non-Urgent (<= 120 min)
"""

import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from flask import Flask, render_template, request, jsonify, redirect, url_for

from ai_assistant import analyze_symptoms

app = Flask(__name__)

# In-memory app state. No database, this is a hackathon prototype.
STATE = {
    "condition_x_active": False,
    "patients_triaged_today": 0,
    "patients_redirected_to_virtual": 0,
    "severity_counts": defaultdict(int),
    "triage_log": [],  # list of {timestamp, severity}
}

# Symptom catalogue grouped by severity tier.
# Critical -> CTAS 1-2, Urgent -> CTAS 3, Moderate -> CTAS 4, Mild -> CTAS 5.
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
}

# Maps severity tier name -> base CTAS level.
TIER_TO_CTAS = {
    "critical": 1,
    "urgent": 3,
    "moderate": 4,
    "mild": 5,
}

# Distance fudge: pretend FSAs are neighbours if they share the first 2 chars.
def estimate_distance_km(patient_fsa, facility_fsa):
    if not patient_fsa:
        return 8.0
    patient_fsa = patient_fsa.strip().upper()
    facility_fsa = facility_fsa.strip().upper()
    if facility_fsa == "ALL":
        return 0.0  # telehealth is "everywhere"
    if patient_fsa == facility_fsa:
        return 1.5
    if patient_fsa[:2] == facility_fsa[:2]:
        return 4.0
    return 9.5


def load_facilities():
    path = os.path.join(os.path.dirname(__file__), "data", "facilities.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def classify_severity(symptoms, age):
    """
    Rule-based CTAS classifier.
    Highest-tier symptom wins. Age extremes (under 5, over 75) bump severity
    one level toward more acute, mirroring real CTAS pediatric/geriatric mods.
    """
    tier = None
    if any(s in SYMPTOMS["critical"] for s in symptoms):
        tier = "critical"
    elif any(s in SYMPTOMS["urgent"] for s in symptoms):
        tier = "urgent"
    elif any(s in SYMPTOMS["moderate"] for s in symptoms):
        tier = "moderate"
    elif any(s in SYMPTOMS["mild"] for s in symptoms):
        tier = "mild"
    else:
        tier = "mild"  # nothing selected -> default to self-care guidance

    ctas = TIER_TO_CTAS[tier]

    # Age boost: bump severity up one level (lower CTAS number) for very young / very old.
    age_boosted = False
    try:
        age_int = int(age)
    except (TypeError, ValueError):
        age_int = 25
    if (age_int < 5 or age_int > 75) and ctas > 1:
        ctas -= 1
        age_boosted = True

    return {
        "tier": tier,
        "ctas_level": ctas,
        "age_boosted": age_boosted,
    }


def current_wait_minutes(facility):
    base = facility["base_wait_minutes"]
    # Condition X surge: triple ER waits, modest bump on urgent care.
    if STATE["condition_x_active"]:
        if facility["type"] == "Hospital ER":
            return base * 3
        if facility["type"] == "Urgent Care":
            return int(base * 1.5)
    return base


def severity_match_score(facility, ctas_level):
    """
    1.0 if facility ideally handles this acuity, lower otherwise.
    A walk-in clinic is a poor match for a CTAS 1 patient.
    """
    handles = facility["handles_severity"]
    if ctas_level in handles:
        # Reward facilities that specialize in this acuity (smallest set wins).
        # ER handles 1-5 but ideal for 1-2; walk-ins ideal for 4-5.
        if facility["type"] == "Hospital ER" and ctas_level <= 2:
            return 1.0
        if facility["type"] == "Urgent Care" and ctas_level == 3:
            return 1.0
        if facility["type"] in ("Walk-in Clinic", "Telehealth") and ctas_level >= 4:
            return 1.0
        return 0.7
    return 0.0


def rank_facilities(facilities, ctas_level, patient_fsa):
    """
    Score = 0.5 * severity_match + 0.3 * wait_score + 0.2 * distance_score.
    Wait/distance scores are normalized so smaller = better.
    """
    waits = [current_wait_minutes(f) for f in facilities]
    max_wait = max(waits) if waits else 1
    dists = [estimate_distance_km(patient_fsa, f["fsa"]) for f in facilities]
    max_dist = max(dists) if dists else 1
    if max_dist == 0:
        max_dist = 1

    scored = []
    for f, wait, dist in zip(facilities, waits, dists):
        sev = severity_match_score(f, ctas_level)
        if sev == 0.0:
            continue  # facility can't handle this acuity at all
        wait_score = 1.0 - (wait / max_wait) if max_wait else 1.0
        dist_score = 1.0 - (dist / max_dist) if max_dist else 1.0
        total = (sev * 0.5) + (wait_score * 0.3) + (dist_score * 0.2)
        scored.append({
            "facility": f,
            "wait_minutes": wait,
            "distance_km": round(dist, 1),
            "score": round(total, 3),
        })
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored


def severity_badge(ctas_level):
    """Maps CTAS level -> (label, tailwind color class)."""
    if ctas_level <= 2:
        return ("Emergency", "bg-red-600")
    if ctas_level == 3:
        return ("Urgent", "bg-orange-500")
    if ctas_level == 4:
        return ("Moderate", "bg-yellow-500")
    return ("Mild", "bg-green-600")


@app.route("/")
def index():
    return render_template(
        "index.html",
        symptoms=SYMPTOMS,
        condition_x=STATE["condition_x_active"],
    )


@app.route("/triage", methods=["POST"])
def triage():
    selected = request.form.getlist("symptoms")
    age = request.form.get("age", "25")
    fsa = request.form.get("fsa", "").strip().upper()[:3]

    classification = classify_severity(selected, age)
    ctas = classification["ctas_level"]
    facilities = load_facilities()
    ranked = rank_facilities(facilities, ctas, fsa)

    # Condition X redirect: non-critical patients get pushed to virtual care.
    redirected = False
    if STATE["condition_x_active"] and ctas >= 3:
        virtual = next((f for f in facilities if f["type"] == "Telehealth"), None)
        if virtual is not None:
            virtual_card = {
                "facility": virtual,
                "wait_minutes": current_wait_minutes(virtual),
                "distance_km": 0.0,
                "score": 1.0,
            }
            ranked = [virtual_card] + [r for r in ranked if r["facility"]["id"] != virtual["id"]]
            STATE["patients_redirected_to_virtual"] += 1
            redirected = True

    top3 = ranked[:3]
    badge_label, badge_class = severity_badge(ctas)

    # Update analytics state.
    STATE["patients_triaged_today"] += 1
    STATE["severity_counts"][ctas] += 1
    STATE["triage_log"].append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ctas": ctas,
    })

    return render_template(
        "results.html",
        classification=classification,
        symptoms=selected,
        age=age,
        fsa=fsa or "Unknown",
        results=top3,
        badge_label=badge_label,
        badge_class=badge_class,
        condition_x=STATE["condition_x_active"],
        redirected=redirected,
    )


@app.route("/dashboard")
def dashboard():
    facilities = load_facilities()
    facility_view = [
        {
            "name": f["name"],
            "type": f["type"],
            "wait": current_wait_minutes(f),
        }
        for f in facilities
    ]
    severity_data = {str(k): STATE["severity_counts"].get(k, 0) for k in range(1, 6)}
    return render_template(
        "dashboard.html",
        facilities=facility_view,
        condition_x=STATE["condition_x_active"],
        triaged_today=STATE["patients_triaged_today"],
        redirected=STATE["patients_redirected_to_virtual"],
        severity_data=severity_data,
        triage_log=STATE["triage_log"],
    )


@app.route("/dashboard/toggle-condition-x", methods=["POST"])
def toggle_condition_x():
    STATE["condition_x_active"] = not STATE["condition_x_active"]
    return redirect(url_for("dashboard"))


@app.route("/api/assistant", methods=["POST"])
def api_assistant():
    """
    Accepts {"text": "free-form symptom description from typing or voice"}.
    Returns structured triage data plus auto-trigger of Condition X if the
    AI flags an outbreak signal.
    """
    payload = request.get_json(silent=True) or {}
    text = (payload.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Please describe what's going on."}), 400

    result = analyze_symptoms(text)
    if "error" in result:
        return jsonify(result), 502

    auto_triggered = False
    if result.get("outbreak_signal") and not STATE["condition_x_active"]:
        STATE["condition_x_active"] = True
        auto_triggered = True

    result["condition_x_active"] = STATE["condition_x_active"]
    result["condition_x_auto_triggered"] = auto_triggered
    return jsonify(result)


@app.route("/api/state")
def api_state():
    """Lightweight JSON endpoint so the dashboard can poll for updates."""
    facilities = load_facilities()
    return jsonify({
        "condition_x_active": STATE["condition_x_active"],
        "patients_triaged_today": STATE["patients_triaged_today"],
        "patients_redirected": STATE["patients_redirected_to_virtual"],
        "severity_counts": {str(k): STATE["severity_counts"].get(k, 0) for k in range(1, 6)},
        "facilities": [
            {"name": f["name"], "type": f["type"], "wait": current_wait_minutes(f)}
            for f in facilities
        ],
    })


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)

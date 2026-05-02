"""
TriageWolf - Brampton's Smart Healthcare Navigator
Built for WolfHacks 2026

Triage logic is based on CTAS (Canadian Triage and Acuity Scale), the
standard 5-level acuity scale used by Canadian emergency departments,
with a Bayesian co-occurrence layer on top for early detection of
cardiac, stroke, sepsis and anaphylaxis patterns.
"""

import json
import os
import secrets
from collections import defaultdict
from datetime import datetime, timezone
from flask import Flask, render_template, request, jsonify, redirect, url_for, abort

from ai_assistant import analyze_symptoms
from triage_engine import (
    SYMPTOMS,
    classify,
    predict_wait_minutes,
    facility_passes_capabilities,
)
from surge_modes import SCENARIOS, get_active_scenario, multipliers_for

app = Flask(__name__)

# ---------------------------------------------------------------------------
# In-memory app state
# ---------------------------------------------------------------------------
STATE = {
    "active_scenario": None,  # one of None, 'condition_x', 'heatwave', 'cyberattack'
    "patients_triaged_today": 0,
    "patients_redirected_to_virtual": 0,
    "severity_counts": defaultdict(int),
    "triage_log": [],
    "handoff_tokens": {},  # token -> handoff payload (in-memory, expires on restart)
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def estimate_distance_km(patient_fsa, facility_fsa):
    if not patient_fsa:
        return 8.0
    patient_fsa = patient_fsa.strip().upper()
    facility_fsa = facility_fsa.strip().upper()
    if facility_fsa == "ALL":
        return 0.0
    if patient_fsa == facility_fsa:
        return 1.5
    if patient_fsa[:2] == facility_fsa[:2]:
        return 4.0
    return 9.5


def load_facilities():
    path = os.path.join(os.path.dirname(__file__), "data", "facilities.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_stats():
    path = os.path.join(os.path.dirname(__file__), "data", "brampton_stats.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def scalability_metrics(stats):
    """
    Estimate measurable impact if 10% of residents use TriageWolf weekly.
    Assumptions are intentionally conservative for a hackathon projection.
    """
    population = stats.get("population", {}).get("current", 700000)
    weekly_users = int(round(population * 0.10))
    non_emergency_deflection = int(round(weekly_users * 0.20))
    clinician_hours_saved = int(round(non_emergency_deflection * 1.1))

    costs = stats.get("cost_per_er_visit_cad", {})
    low = int(costs.get("non_admitted_low", 600))
    high = int(costs.get("non_admitted_high", 1000))

    return {
        "weekly_users": weekly_users,
        "deflected_cases": non_emergency_deflection,
        "clinician_hours_saved": clinician_hours_saved,
        "cost_savings_low": non_emergency_deflection * low,
        "cost_savings_high": non_emergency_deflection * high,
    }


def severity_match_score(facility, ctas_level):
    handles = facility["handles_severity"]
    if ctas_level not in handles:
        return 0.0
    if facility["type"] == "Hospital ER" and ctas_level <= 2:
        return 1.0
    if facility["type"] == "Urgent Care" and ctas_level == 3:
        return 1.0
    if facility["type"] in ("Walk-in Clinic", "Telehealth") and ctas_level >= 4:
        return 1.0
    return 0.7


def severity_badge(ctas_level):
    if ctas_level <= 2:
        return ("Emergency", "bg-red-600")
    if ctas_level == 3:
        return ("Urgent", "bg-orange-500")
    if ctas_level == 4:
        return ("Moderate", "bg-yellow-500")
    return ("Mild", "bg-green-600")


def current_wait(facility):
    """Predicted wait minutes given the active surge scenario."""
    mults = multipliers_for(facility, STATE)
    minutes, _ = predict_wait_minutes(facility, mults)
    return minutes


def wait_breakdown(facility):
    mults = multipliers_for(facility, STATE)
    return predict_wait_minutes(facility, mults)


def rank_facilities(facilities, ctas_level, patient_fsa, demographics, required_caps):
    """
    Score = 0.5 * severity_match + 0.3 * wait_score + 0.2 * distance_score
    with capability hard-filter and demographic boosts.
    """
    scen_key, scen = get_active_scenario(STATE)
    require_ac = bool(scen and scen["routing"].get("require_ac"))
    prefer_offline = bool(scen and scen["routing"].get("prefer_offline_capable"))
    boost_vulnerable = bool(scen and scen["routing"].get("boost_seniors_and_chronic"))

    waits = [current_wait(f) for f in facilities]
    max_wait = max(waits) if waits else 1
    dists = [estimate_distance_km(patient_fsa, f["fsa"]) for f in facilities]
    max_dist = max(dists) if dists else 1
    if max_dist == 0:
        max_dist = 1

    try:
        age_int = int(demographics.get("age") or 25)
    except (TypeError, ValueError):
        age_int = 25
    is_vulnerable = age_int >= 65 or bool(demographics.get("chronic_conditions"))

    scored = []
    for f, wait, dist in zip(facilities, waits, dists):
        # Hard filters from triage engine
        if not facility_passes_capabilities(f, required_caps):
            continue
        # Heatwave: require AC indoor for non-critical
        if require_ac and ctas_level >= 3 and not f.get("capabilities", {}).get("ac_indoor"):
            continue

        sev = severity_match_score(f, ctas_level)
        if sev == 0.0:
            continue

        wait_score = 1.0 - (wait / max_wait) if max_wait else 1.0
        dist_score = 1.0 - (dist / max_dist) if max_dist else 1.0
        total = (sev * 0.5) + (wait_score * 0.3) + (dist_score * 0.2)

        if prefer_offline and f.get("capabilities", {}).get("offline_protocol"):
            total += 0.10
        if boost_vulnerable and is_vulnerable:
            # seniors / chronic during heatwave: prefer closer + AC
            total += 0.08 * dist_score

        scored.append({
            "facility": f,
            "wait_minutes": wait,
            "distance_km": round(dist, 1),
            "score": round(total, 3),
        })
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored


def predictive_alerts():
    """
    Scan facilities for capacity pressure. Returns list of warnings.
    A facility is 'hot' if its predicted wait exceeds 180 min OR queue
    is at >= 90% of clinician saturation (queue / clinicians >= 8).
    """
    out = []
    for f in load_facilities():
        wait = current_wait(f)
        saturation = f.get("queue_length", 0) / max(1, f.get("clinicians", 1))
        if wait >= 180 or saturation >= 8:
            out.append({
                "facility": f["name"],
                "type": f["type"],
                "wait_minutes": wait,
                "saturation": round(saturation, 1),
                "advice": f"{f['name']} is near capacity. Consider an alternative.",
            })
    return out


# ---------------------------------------------------------------------------
# Routes - public flow
# ---------------------------------------------------------------------------

@app.route("/")
@app.route("/app")
def index():
    scen_key, scen = get_active_scenario(STATE)
    return render_template(
        "index.html",
        symptoms=SYMPTOMS,
        active_scenario=scen_key,
        scenario=scen,
        predictive=predictive_alerts(),
        facility_count=len(load_facilities()),
        warning_count=len(predictive_alerts()),
    )


@app.route("/prototype")
def prototype_preview():
    return redirect(url_for("index"))


@app.route("/triage", methods=["POST"])
def triage():
    selected = request.form.getlist("symptoms")
    age = request.form.get("age", "25").strip()
    fsa_raw = request.form.get("fsa", "").strip().upper()
    fsa = fsa_raw[:3] if fsa_raw else ""

    # Demographic inputs
    demographics = {
        "age": age,
        "pregnant": bool(request.form.get("pregnant")),
        "chronic_conditions": request.form.getlist("chronic"),
        "caregiver_mode": bool(request.form.get("caregiver_mode")),
        "patient_name": request.form.get("patient_name", "").strip(),
        "relationship": request.form.get("relationship", "").strip(),
        "needs_transport": bool(request.form.get("needs_transport")),
    }

    # Validation: invalid FSA still works but show note. No symptoms = mild self-care.
    if fsa and (len(fsa) != 3 or not fsa[0].isalpha() or not fsa[1].isdigit() or not fsa[2].isalpha()):
        fsa_warning = f"'{fsa_raw}' doesn't look like a valid Canadian FSA - showing nearest matches anyway."
    else:
        fsa_warning = None

    classification = classify(selected, age, demographics)
    ctas = classification["ctas_level"]

    facilities = load_facilities()
    ranked = rank_facilities(
        facilities, ctas, fsa,
        demographics=demographics,
        required_caps=classification["required_capabilities"],
    )

    # Surge-driven redirect to telehealth
    redirected = False
    scen_key, scen = get_active_scenario(STATE)
    if scen and ctas >= scen["routing"].get("promote_virtual_for_ctas_ge", 99):
        virtual = next((f for f in facilities if f["type"] == "Telehealth"), None)
        if virtual is not None:
            mults = multipliers_for(virtual, STATE)
            v_wait, _ = predict_wait_minutes(virtual, mults)
            virtual_card = {
                "facility": virtual,
                "wait_minutes": v_wait,
                "distance_km": 0.0,
                "score": 1.0,
            }
            ranked = [virtual_card] + [r for r in ranked if r["facility"]["id"] != virtual["id"]]
            STATE["patients_redirected_to_virtual"] += 1
            redirected = True

    top3 = ranked[:3]
    badge_label, badge_class = severity_badge(ctas)

    # Generate QR handoff token
    token = secrets.token_urlsafe(8)
    top_facility_name = top3[0]["facility"]["name"] if top3 else None
    STATE["handoff_tokens"][token] = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "ctas_level": ctas,
        "tier": classification["tier"],
        "symptoms": selected,
        "age": age,
        "fsa": fsa,
        "patient_name": demographics["patient_name"],
        "caregiver_mode": demographics["caregiver_mode"],
        "relationship": demographics["relationship"],
        "demographic_modifiers": classification["demographic_modifiers"],
        "bayesian_matches": classification["bayesian_matches"],
        "tier_reason": classification["tier_reason"],
        "recommended_facility": top_facility_name,
    }

    # Analytics
    STATE["patients_triaged_today"] += 1
    STATE["severity_counts"][ctas] += 1
    STATE["triage_log"].append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ctas": ctas,
    })

    handoff_url = url_for("handoff", token=token, _external=True)

    return render_template(
        "results.html",
        classification=classification,
        symptoms=selected,
        age=age,
        demographics=demographics,
        fsa=fsa or "Unknown",
        fsa_warning=fsa_warning,
        results=top3,
        badge_label=badge_label,
        badge_class=badge_class,
        active_scenario=scen_key,
        scenario=scen,
        redirected=redirected,
        handoff_token=token,
        handoff_url=handoff_url,
        offline_mode=bool(scen and scen["routing"].get("offline_mode")),
    )


@app.route("/handoff/<token>")
def handoff(token):
    """Facility-side QR landing page. Shown when staff scan the patient's QR."""
    payload = STATE["handoff_tokens"].get(token)
    if not payload:
        abort(404)
    return render_template("handoff.html", payload=payload, token=token)


# ---------------------------------------------------------------------------
# Routes - dashboard
# ---------------------------------------------------------------------------

@app.route("/dashboard")
def dashboard():
    facilities = load_facilities()
    facility_view = []
    for f in facilities:
        minutes, breakdown = wait_breakdown(f)
        facility_view.append({
            "name": f["name"],
            "type": f["type"],
            "wait": minutes,
            "breakdown": breakdown,
            "queue_length": f["queue_length"],
            "clinicians": f["clinicians"],
        })
    severity_data = {str(k): STATE["severity_counts"].get(k, 0) for k in range(1, 6)}
    scen_key, scen = get_active_scenario(STATE)
    return render_template(
        "dashboard.html",
        facilities=facility_view,
        active_scenario=scen_key,
        scenario=scen,
        scenarios=SCENARIOS,
        triaged_today=STATE["patients_triaged_today"],
        redirected=STATE["patients_redirected_to_virtual"],
        severity_data=severity_data,
        triage_log=STATE["triage_log"],
    )


@app.route("/dashboard/scenario", methods=["POST"])
def set_scenario():
    """Activate / deactivate one of the three disruption scenarios."""
    requested = request.form.get("scenario") or None
    if requested == "off" or requested is None:
        STATE["active_scenario"] = None
    elif requested in SCENARIOS:
        STATE["active_scenario"] = requested
    return redirect(url_for("dashboard"))


@app.route("/dashboard/toggle-condition-x", methods=["POST"])
def toggle_condition_x_legacy():
    if STATE["active_scenario"] == "condition_x":
        STATE["active_scenario"] = None
    else:
        STATE["active_scenario"] = "condition_x"
    return redirect(url_for("dashboard"))


# ---------------------------------------------------------------------------
# Routes - storytelling pages
# ---------------------------------------------------------------------------

@app.route("/impact")
def impact():
    stats = load_stats()
    return render_template("impact.html", stats=stats, scale=scalability_metrics(stats))


@app.route("/pitch")
def pitch():
    stats = load_stats()
    return render_template("pitch.html", stats=stats, scale=scalability_metrics(stats))


@app.route("/constraints")
def constraints():
    stats = load_stats()
    return render_template("constraints.html", stats=stats)


@app.route("/sms-demo")
def sms_demo():
    return render_template("sms_demo.html")


# ---------------------------------------------------------------------------
# JSON APIs
# ---------------------------------------------------------------------------

@app.route("/api/assistant", methods=["POST"])
def api_assistant():
    payload = request.get_json(silent=True) or {}
    text = (payload.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Please describe what's going on."}), 400

    result = analyze_symptoms(text)
    if "error" in result:
        return jsonify(result), 502

    auto_triggered = False
    if result.get("outbreak_signal") and STATE["active_scenario"] != "condition_x":
        STATE["active_scenario"] = "condition_x"
        auto_triggered = True

    result["condition_x_active"] = STATE["active_scenario"] == "condition_x"
    result["active_scenario"] = STATE["active_scenario"]
    result["condition_x_auto_triggered"] = auto_triggered
    return jsonify(result)


@app.route("/api/state")
def api_state():
    facilities = load_facilities()
    facility_view = []
    for f in facilities:
        minutes, _ = wait_breakdown(f)
        facility_view.append({"name": f["name"], "type": f["type"], "wait": minutes})
    return jsonify({
        "active_scenario": STATE["active_scenario"],
        "condition_x_active": STATE["active_scenario"] == "condition_x",
        "patients_triaged_today": STATE["patients_triaged_today"],
        "patients_redirected": STATE["patients_redirected_to_virtual"],
        "severity_counts": {str(k): STATE["severity_counts"].get(k, 0) for k in range(1, 6)},
        "facilities": facility_view,
        "predictive_alerts": predictive_alerts(),
    })


@app.route("/api/predictive")
def api_predictive():
    return jsonify({"alerts": predictive_alerts()})


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------

@app.errorhandler(404)
def not_found(e):
    return render_template("error.html", code=404, message="Page not found."), 404


@app.errorhandler(500)
def server_err(e):
    return render_template("error.html", code=500, message="Something broke. Please try again."), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)

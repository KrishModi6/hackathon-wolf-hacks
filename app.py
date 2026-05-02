"""
SwiftCare Brampton - Brampton's Smart Healthcare Navigator
Built for WolfHacks 2026

Triage logic is based on CTAS (Canadian Triage and Acuity Scale), the
standard 5-level acuity scale used by Canadian emergency departments,
with machine learning on top for early detection of
cardiac, stroke, sepsis and anaphylaxis patterns.
"""

import json
import os
import secrets
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from flask import Flask, render_template, request, jsonify, redirect, url_for, abort, session

from ai_assistant import analyze_symptoms
from triage_engine import (
    SYMPTOMS,
    classify,
    predict_wait_minutes,
    facility_passes_capabilities,
)
from surge_modes import SCENARIOS, get_active_scenario, multipliers_for

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "swiftcare-dev-secret")

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
    "consult_requests": [],
    "critical_intake_packets": [],
    "mental_health_chats": [],
    "mental_health_er_tickets": [],
    "emergency_responses": [],
}

MENTAL_HEALTH_RESOURCES = {
    "crisis": {
        "name": "9-8-8 Suicide Crisis Helpline",
        "action": "Call or text 9-8-8 in Canada, 24/7.",
        "url": "https://988.ca/",
    },
    "youth": {
        "name": "Kids Help Phone",
        "action": "Call, text, or chat for youth mental-health support across Canada.",
        "url": "https://kidshelpphone.ca/",
    },
    "virtual": {
        "name": "TELUS Health MyCare",
        "action": "Book virtual care with a Canadian clinician where available.",
        "url": "https://www.telus.com/en/health/my-care/doctors",
    },
}

MENTAL_HEALTH_PHARMACIES = [
    {
        "name": "Shoppers Drug Mart - Bramalea City Centre",
        "type": "Pharmacy",
        "address": "25 Peel Centre Dr, Brampton, ON",
        "fsa": "L6T",
        "phone": "905-793-8888",
    },
    {
        "name": "Rexall - Heart Lake",
        "type": "Pharmacy",
        "address": "164 Sandalwood Pkwy E, Brampton, ON",
        "fsa": "L6Z",
        "phone": "905-846-1400",
    },
]

PARTNER_PHARMACIES = [
    {
        "name": "Shoppers Drug Mart - Bramalea City Centre",
        "type": "Partner Pharmacy",
        "address": "25 Peel Centre Dr, Brampton, ON",
        "fsa": "L6T",
        "phone": "905-793-8888",
    },
    {
        "name": "Rexall - Heart Lake",
        "type": "Partner Pharmacy",
        "address": "164 Sandalwood Pkwy E, Brampton, ON",
        "fsa": "L6Z",
        "phone": "905-846-1400",
    },
    {
        "name": "Pharmasave Brampton",
        "type": "Partner Pharmacy",
        "address": "60 Gillingham Dr, Brampton, ON",
        "fsa": "L6X",
        "phone": "905-450-7000",
    },
]


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
    Estimate measurable impact if 10% of residents use SwiftCare Brampton weekly.
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


def risk_recommendation(ctas_level):
    """Map clinical acuity into the simple user-facing risk ladder."""
    if ctas_level <= 2:
        return {
            "level": "HIGH",
            "action": "Seek emergency care",
            "description": "Your symptoms may need immediate in-person care. If this feels urgent, call 911.",
            "class": "risk-high",
        }
    if ctas_level == 3:
        return {
            "level": "MEDIUM",
            "action": "Consider virtual care",
            "description": "You should speak with a clinician soon. Virtual care or urgent care can help decide the fastest next step.",
            "class": "risk-medium",
        }
    return {
        "level": "LOW",
        "action": "Stay home and monitor",
        "description": "Self-care, monitoring, or non-urgent clinic support is likely appropriate unless symptoms worsen.",
        "class": "risk-low",
    }


def triage_payload_from_token(token):
    if not token:
        return None
    return STATE["handoff_tokens"].get(token)


def consult_confirmation(kind, payload):
    if kind == "critical":
        return {
            "title": "Emergency intake packet sent",
            "message": "Your detailed symptoms were sent to the clinical intake queue so the care team can review them before you arrive.",
            "reference": payload["reference"],
        }
    return {
        "title": "Online consultation requested",
        "message": "Your booking request was sent to the virtual care queue. A doctor can review your symptoms and profile before the consultation.",
        "reference": payload["reference"],
    }


def analyze_mental_health_message(text, profile=None):
    """
    DSM-5-informed screening, not diagnosis. This keeps the prototype on
    symptom domains and care navigation instead of clinical labeling.
    """
    raw = (text or "").strip()
    lower = raw.lower()
    crisis_terms = [
        "suicide", "kill myself", "end my life", "self harm", "self-harm",
        "hurt myself", "hurt someone", "harm someone", "overdose", "no reason to live",
    ]
    urgent_terms = [
        "hearing voices", "seeing things", "paranoid", "manic", "mania",
        "haven't slept", "cannot sleep for days", "panic attack", "can't breathe",
        "not eating", "can't function", "unsafe", "abuse",
    ]
    anxiety_terms = ["anxious", "anxiety", "panic", "worry", "overthinking", "racing thoughts"]
    mood_terms = ["depressed", "sad", "hopeless", "empty", "worthless", "crying", "no motivation"]
    trauma_terms = ["trauma", "flashback", "nightmare", "ptsd", "triggered"]
    substance_terms = ["alcohol", "weed", "cocaine", "opioid", "drugs", "withdrawal"]

    domains = []
    if any(t in lower for t in anxiety_terms):
        domains.append("anxiety and stress symptoms")
    if any(t in lower for t in mood_terms):
        domains.append("low mood symptoms")
    if any(t in lower for t in trauma_terms):
        domains.append("trauma-related symptoms")
    if any(t in lower for t in substance_terms):
        domains.append("substance-use concerns")
    if not domains:
        domains.append("general emotional distress")

    if any(t in lower for t in crisis_terms):
        level = "CRISIS"
        action = "Call or text 9-8-8 now, or call 911 if there is immediate danger."
        eta_minutes = 12
        steps = [
            "Move away from anything you could use to harm yourself or someone else.",
            "Stay with another person or ask someone trusted to stay with you.",
            "Call or text 9-8-8 now for live crisis support in Canada.",
        ]
    elif any(t in lower for t in urgent_terms):
        level = "URGENT"
        action = "Talk to a live mental-health professional today."
        eta_minutes = 25
        steps = [
            "Use slow breathing: inhale for 4, hold for 2, exhale for 6, repeat five times.",
            "Ground with five things you can see, four you can feel, three you can hear.",
            "Use the emergency intake form if symptoms feel unsafe or are getting worse.",
        ]
    elif any(t in lower for t in anxiety_terms + mood_terms + trauma_terms + substance_terms):
        level = "SUPPORT"
        action = "Use at-home coping steps and consider chat or virtual care."
        eta_minutes = 45
        steps = [
            "Name the feeling, rate it from 1 to 10, and write down what triggered it.",
            "Drink water, eat something simple, and step outside or near a window for a few minutes.",
            "Message a trusted person with one concrete ask, like staying on the phone for 10 minutes.",
        ]
    else:
        level = "MINOR"
        action = "Monitor, use self-care, and connect with primary care if it keeps happening."
        eta_minutes = 60
        steps = [
            "Try a 10-minute reset: breathe slowly, stretch, and reduce noise or screen overload.",
            "Track sleep, food, caffeine, substances, and stress for the next 24 hours.",
            "Use a walk-in, family doctor, pharmacy, or virtual care if symptoms persist.",
        ]

    return {
        "level": level,
        "action": action,
        "domains": domains,
        "summary": f"This sounds most consistent with {', '.join(domains)}. This is not a diagnosis.",
        "steps": steps,
        "eta_minutes": eta_minutes,
        "resources": MENTAL_HEALTH_RESOURCES,
        "dsm_note": "DSM-5-informed screening reference only; a licensed clinician must diagnose.",
    }


def mental_health_care_options(profile):
    fsa = (profile or {}).get("fsa", "")
    facilities = load_facilities()
    local = [f for f in facilities if f["type"] in ("Walk-in Clinic", "Telehealth")]
    options = []
    for facility in local:
        options.append({
            "name": facility["name"],
            "type": facility["type"],
            "address": facility["address"],
            "phone": facility.get("phone"),
            "distance_km": estimate_distance_km(fsa, facility["fsa"]),
            "wait_minutes": current_wait(facility),
            "maps_url": f"https://www.google.com/maps/search/?api=1&query={facility['address'].replace(' ', '+')}",
        })
    for pharmacy in MENTAL_HEALTH_PHARMACIES:
        options.append({
            **pharmacy,
            "distance_km": estimate_distance_km(fsa, pharmacy["fsa"]),
            "wait_minutes": 20,
            "maps_url": f"https://www.google.com/maps/search/?api=1&query={pharmacy['address'].replace(' ', '+')}",
        })
    options.sort(key=lambda item: (item["distance_km"], item["wait_minutes"]))
    return options[:4]


def partner_care_options(profile):
    fsa = (profile or {}).get("fsa", "")
    options = []
    for facility in load_facilities():
        if facility["type"] not in ("Walk-in Clinic", "Telehealth"):
            continue
        options.append({
            "name": facility["name"],
            "type": facility["type"],
            "address": facility["address"],
            "phone": facility.get("phone"),
            "distance_km": estimate_distance_km(fsa, facility["fsa"]),
            "wait_minutes": current_wait(facility),
            "maps_url": f"https://www.google.com/maps/search/?api=1&query={facility['address'].replace(' ', '+')}",
        })
    for pharmacy in PARTNER_PHARMACIES:
        options.append({
            **pharmacy,
            "distance_km": estimate_distance_km(fsa, pharmacy["fsa"]),
            "wait_minutes": 15,
            "maps_url": f"https://www.google.com/maps/search/?api=1&query={pharmacy['address'].replace(' ', '+')}",
        })
    options.sort(key=lambda item: (item["distance_km"], item["wait_minutes"]))
    return options[:5]


def create_emergency_response(profile, triage_payload):
    reference = f"AMB-{secrets.token_hex(3).upper()}"
    hospital = next((f for f in load_facilities() if f["type"] == "Hospital ER"), None)
    eta_minutes = 9 if triage_payload and triage_payload.get("ctas_level", 5) == 1 else 14
    created = datetime.now(timezone.utc)
    response = {
        "reference": reference,
        "created_at": created.isoformat(),
        "eta": (created + timedelta(minutes=eta_minutes)).isoformat(),
        "eta_minutes": eta_minutes,
        "ambulance_unit": f"Peel EMS-{secrets.randbelow(70) + 20}",
        "paramedic": {
            "name": "Primary Care Paramedic on duty",
            "channel": f"Secure voice channel {secrets.randbelow(80) + 10}",
            "status": "Connected to triage packet",
        },
        "profile": profile,
        "triage": triage_payload,
        "destination": hospital,
        "tracking": [
            {"label": "911 request received", "status": "complete", "minutes": 0},
            {"label": "Health dispatcher reviewing symptoms", "status": "complete", "minutes": 1},
            {"label": "Ambulance assigned", "status": "active", "minutes": 2},
            {"label": "Paramedic connected to intake packet", "status": "active", "minutes": 3},
            {"label": "Arriving at your location", "status": "pending", "minutes": eta_minutes},
        ],
        "instructions": [
            "Unlock the door or ask someone nearby to meet paramedics.",
            "Do not eat or drink unless emergency staff tell you to.",
            "Keep medications, allergies, health card, and phone nearby.",
            "If symptoms worsen before arrival, call 911 directly.",
        ],
        "prototype_notice": "Prototype only: this does not contact real 911 or dispatch an ambulance.",
    }
    STATE["emergency_responses"].append(response)
    return response


def create_mental_health_ticket(profile, payload, analysis):
    reference = f"MH-{secrets.token_hex(3).upper()}"
    facility = next((f for f in load_facilities() if f["type"] == "Hospital ER"), None)
    eta = datetime.now(timezone.utc) + timedelta(minutes=analysis.get("eta_minutes", 30))
    ticket = {
        "reference": reference,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "eta": eta.isoformat(),
        "eta_minutes": analysis.get("eta_minutes", 30),
        "profile": profile,
        "analysis": analysis,
        "symptom_story": payload.get("symptom_story", "").strip(),
        "safety_concern": payload.get("safety_concern", "").strip(),
        "arrival_method": payload.get("arrival_method", "").strip(),
        "email": payload.get("email", "").strip() or (profile or {}).get("email", ""),
        "facility": facility,
        "instructions": [
            "Bring ID, medication list, and allergy information.",
            "Do not drive yourself if you feel unsafe, dissociated, severely panicked, or at risk of self-harm.",
            "Call 911 immediately if danger becomes immediate before arrival.",
        ],
    }
    STATE["mental_health_er_tickets"].append(ticket)
    return ticket


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
    profile = session.get("profile")
    if not profile:
        return redirect(url_for("account"))
    scen_key, scen = get_active_scenario(STATE)
    facilities = load_facilities()
    nearby = []
    for f in facilities[:4]:
        wait = current_wait(f)
        nearby.append({
            "short_name": f["name"].replace("Brampton ", "").replace(" Medical", "").replace(" Centre", ""),
            "type": f["type"],
            "wait": wait,
        })
    now_label = datetime.now(timezone.utc).strftime("%a %b %d · %H:%M UTC")
    return render_template(
        "index.html",
        symptoms=SYMPTOMS,
        profile=profile,
        active_scenario=scen_key,
        scenario=scen,
        predictive=predictive_alerts(),
        facility_count=len(facilities),
        warning_count=len(predictive_alerts()),
        nearby_facilities=nearby,
        now_label=now_label,
        active_sessions=STATE["patients_triaged_today"] + 1284,
    )


@app.route("/account", methods=["GET", "POST"])
def account():
    profile = session.get("profile", {})
    if request.method == "POST":
        age = request.form.get("age", "").strip()
        fsa_raw = request.form.get("fsa", "").strip().upper()
        session["profile"] = {
            "name": request.form.get("name", "").strip(),
            "email": request.form.get("email", "").strip(),
            "age": age or "25",
            "fsa": fsa_raw[:3] if fsa_raw else "",
            "pregnant": bool(request.form.get("pregnant")),
            "chronic_conditions": request.form.getlist("chronic"),
            "allergies": request.form.get("allergies", "").strip(),
            "medications": request.form.get("medications", "").strip(),
            "emergency_contact": request.form.get("emergency_contact", "").strip(),
        }
        return redirect(url_for("index"))

    return render_template("account.html", profile=profile)


@app.route("/logout")
def logout():
    session.pop("profile", None)
    return redirect(url_for("account"))


@app.route("/consult", methods=["GET", "POST"])
def consult():
    profile = session.get("profile")
    if not profile:
        return redirect(url_for("account"))

    token = request.values.get("token") or session.get("last_triage_token")
    triage_payload = triage_payload_from_token(token)
    mode = request.values.get("mode") or ("critical" if triage_payload and triage_payload.get("ctas_level", 5) <= 2 else "consult")
    confirmation = None

    if request.method == "POST":
        submitted_mode = request.form.get("mode") or mode
        reference = secrets.token_hex(4).upper()
        base_packet = {
            "reference": reference,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "triage_token": token,
            "profile": profile,
            "triage": triage_payload,
        }

        if submitted_mode == "critical":
            packet = {
                **base_packet,
                "arrival_method": request.form.get("arrival_method", "").strip(),
                "symptom_story": request.form.get("symptom_story", "").strip(),
                "started_at": request.form.get("started_at", "").strip(),
                "getting_worse": bool(request.form.get("getting_worse")),
                "pain_scale": request.form.get("pain_scale", "").strip(),
                "breathing_status": request.form.get("breathing_status", "").strip(),
                "notes_for_team": request.form.get("notes_for_team", "").strip(),
                "destination": request.form.get("destination", "").strip(),
            }
            STATE["critical_intake_packets"].append(packet)
            confirmation = consult_confirmation("critical", packet)
            mode = "critical"
        else:
            packet = {
                **base_packet,
                "preferred_time": request.form.get("preferred_time", "").strip(),
                "visit_reason": request.form.get("visit_reason", "").strip(),
                "phone": request.form.get("phone", "").strip(),
                "video_ok": bool(request.form.get("video_ok")),
                "pharmacy": request.form.get("pharmacy", "").strip(),
            }
            STATE["consult_requests"].append(packet)
            confirmation = consult_confirmation("consult", packet)
            mode = "consult"

    return render_template(
        "consult.html",
        profile=profile,
        mode=mode,
        token=token,
        triage=triage_payload,
        confirmation=confirmation,
        consult_count=len(STATE["consult_requests"]),
        critical_count=len(STATE["critical_intake_packets"]),
    )


@app.route("/mental-health")
def mental_health():
    profile = session.get("profile")
    if not profile:
        return redirect(url_for("account"))
    return render_template(
        "mental_health.html",
        profile=profile,
        resources=MENTAL_HEALTH_RESOURCES,
        care_options=mental_health_care_options(profile),
        tickets=STATE["mental_health_er_tickets"][-3:],
    )


@app.route("/mental-health/emergency", methods=["POST"])
def mental_health_emergency():
    profile = session.get("profile")
    if not profile:
        return redirect(url_for("account"))
    story = request.form.get("symptom_story", "")
    analysis = analyze_mental_health_message(story, profile)
    ticket = create_mental_health_ticket(profile, request.form, analysis)
    return render_template(
        "mental_health.html",
        profile=profile,
        resources=MENTAL_HEALTH_RESOURCES,
        care_options=mental_health_care_options(profile),
        emergency_ticket=ticket,
        tickets=STATE["mental_health_er_tickets"][-3:],
    )


@app.route("/emergency-response", methods=["GET", "POST"])
def emergency_response():
    profile = session.get("profile")
    if not profile:
        return redirect(url_for("account"))

    if request.method == "POST":
        token = request.form.get("token") or session.get("last_triage_token")
        triage_payload = triage_payload_from_token(token)
        response = create_emergency_response(profile, triage_payload)
    else:
        reference = request.args.get("reference")
        response = next((item for item in STATE["emergency_responses"] if item["reference"] == reference), None)
        if not response:
            token = request.args.get("token") or session.get("last_triage_token")
            response = create_emergency_response(profile, triage_payload_from_token(token))

    return render_template("emergency_response.html", response=response)


@app.route("/prototype")
def prototype_preview():
    return redirect(url_for("index"))


@app.route("/triage", methods=["POST"])
def triage():
    profile = session.get("profile", {})
    selected = request.form.getlist("symptoms")
    age = request.form.get("age", profile.get("age", "25")).strip()
    fsa_raw = request.form.get("fsa", profile.get("fsa", "")).strip().upper()
    fsa = fsa_raw[:3] if fsa_raw else ""

    # Demographic inputs
    demographics = {
        "age": age,
        "pregnant": bool(request.form.get("pregnant")),
        "chronic_conditions": request.form.getlist("chronic"),
        "profile_name": profile.get("name", ""),
        "profile_email": profile.get("email", ""),
        "allergies": profile.get("allergies", ""),
        "medications": profile.get("medications", ""),
        "emergency_contact": profile.get("emergency_contact", ""),
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
    risk = risk_recommendation(ctas)

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
        "profile_name": demographics["profile_name"],
        "allergies": demographics["allergies"],
        "medications": demographics["medications"],
        "emergency_contact": demographics["emergency_contact"],
        "demographic_modifiers": classification["demographic_modifiers"],
        "pattern_matches": classification["pattern_matches"],
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
    session["last_triage_token"] = token

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
        risk=risk,
        active_scenario=scen_key,
        scenario=scen,
        redirected=redirected,
        handoff_token=token,
        handoff_url=handoff_url,
        consult_url=url_for("consult", token=token, mode="consult"),
        critical_intake_url=url_for("consult", token=token, mode="critical"),
        partner_options=partner_care_options(profile),
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
    now_label = datetime.now(timezone.utc).strftime("%a %b %d · %H:%M UTC")
    return render_template(
        "dashboard.html",
        facilities=facility_view,
        active_scenario=scen_key,
        scenario=scen,
        scenarios=SCENARIOS,
        triaged_today=STATE["patients_triaged_today"],
        redirected=STATE["patients_redirected_to_virtual"],
        consult_requests=STATE["consult_requests"],
        critical_intake_packets=STATE["critical_intake_packets"],
        mental_health_er_tickets=STATE["mental_health_er_tickets"],
        emergency_responses=STATE["emergency_responses"],
        severity_data=severity_data,
        triage_log=STATE["triage_log"],
        now_label=now_label,
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


@app.route("/maps")
def maps():
    facilities = load_facilities()
    return render_template("maps.html", facilities=facilities)


@app.route("/api/facilities")
def api_facilities():
    """API endpoint to get all facilities with wait times and locations."""
    facilities = load_facilities()
    state = get_active_scenario(STATE)
    
    result = []
    for facility in facilities:
        wait_time, wait_data = predict_wait_minutes(facility, multipliers_for(facility, STATE))
        result.append({
            "id": facility["id"],
            "name": facility["name"],
            "type": facility["type"],
            "address": facility["address"],
            "phone": facility["phone"],
            "lat": facility.get("lat"),
            "lng": facility.get("lng"),
            "wait_minutes": wait_time,
            "queue_length": facility.get("queue_length", 0),
            "mobile_clinic": facility.get("mobile_clinic", False),
            "capabilities": facility.get("capabilities", {})
        })
    
    return jsonify(result)


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


@app.route("/api/mental-health/chat", methods=["POST"])
def api_mental_health_chat():
    profile = session.get("profile", {})
    payload = request.get_json(silent=True) or {}
    text = (payload.get("message") or "").strip()
    if not text:
        return jsonify({"error": "Please write what you are feeling first."}), 400
    analysis = analyze_mental_health_message(text, profile)
    STATE["mental_health_chats"].append({
        "created_at": datetime.now(timezone.utc).isoformat(),
        "profile": profile,
        "message": text,
        "analysis": analysis,
    })
    return jsonify(analysis)


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
        "consult_requests": len(STATE["consult_requests"]),
        "critical_intake_packets": len(STATE["critical_intake_packets"]),
        "mental_health_chats": len(STATE["mental_health_chats"]),
        "mental_health_er_tickets": len(STATE["mental_health_er_tickets"]),
        "emergency_responses": len(STATE["emergency_responses"]),
        "severity_counts": {str(k): STATE["severity_counts"].get(k, 0) for k in range(1, 6)},
        "facilities": facility_view,
        "predictive_alerts": predictive_alerts(),
    })


@app.route("/api/clinical-intake")
def api_clinical_intake():
    return jsonify({
        "consult_requests": STATE["consult_requests"],
        "critical_intake_packets": STATE["critical_intake_packets"],
        "mental_health_chats": STATE["mental_health_chats"],
        "mental_health_er_tickets": STATE["mental_health_er_tickets"],
        "emergency_responses": STATE["emergency_responses"],
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

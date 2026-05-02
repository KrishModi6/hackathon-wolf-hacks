"""
Three disruption scenarios TriageWolf can adapt to.

Each scenario tweaks (a) wait-time multipliers per facility type,
(b) routing logic (e.g. promote virtual care, deprioritize ER),
(c) the public banner shown to patients, and (d) the offline-mode flag.

Only ONE scenario can be active at a time. Activating a new one
deactivates the others.
"""

SCENARIOS = {
    "condition_x": {
        "label": "Condition X Outbreak",
        "icon": "🦠",
        "banner": "CONDITION X ALERT: Brampton hospitals at capacity. Non-emergency patients are being routed to virtual triage.",
        "description": "Novel infectious disease outbreak. ER capacity tripled, virtual care promoted for non-critical cases.",
        "wait_multipliers": {
            "Hospital ER": {"queue_mult": 3.0, "service_mult": 1.0},
            "Urgent Care": {"queue_mult": 1.5, "service_mult": 1.0},
            "Walk-in Clinic": {"queue_mult": 1.0, "service_mult": 1.0},
            "Telehealth": {"queue_mult": 0.5, "service_mult": 1.0},
        },
        "routing": {
            "promote_virtual_for_ctas_ge": 3,
            "deprioritize_types": [],
            "offline_mode": False,
        },
        "patient_advice": "Wear a mask. Call ahead. Use virtual triage if your symptoms are non-life-threatening.",
    },
    "heatwave": {
        "label": "Heatwave / Extreme Weather",
        "icon": "🌡️",
        "banner": "HEAT EMERGENCY: Extreme heat advisory in effect. Stay hydrated. Seniors and chronic-condition patients prioritized.",
        "description": "Heatwave protocol. Vulnerable demographics get priority routing; AC-equipped facilities preferred.",
        "wait_multipliers": {
            "Hospital ER": {"queue_mult": 1.6, "service_mult": 1.1},
            "Urgent Care": {"queue_mult": 1.3, "service_mult": 1.0},
            "Walk-in Clinic": {"queue_mult": 1.1, "service_mult": 1.0},
            "Telehealth": {"queue_mult": 1.0, "service_mult": 1.0},
        },
        "routing": {
            "promote_virtual_for_ctas_ge": 99,  # don't push virtual
            "require_ac": True,
            "boost_seniors_and_chronic": True,
            "offline_mode": False,
        },
        "patient_advice": "Drink water every 15 min. Avoid outdoor activity 11am-4pm. Check on elderly neighbours. Cooling centres open at city libraries and Civic Centre.",
    },
    "cyberattack": {
        "label": "Cyberattack / EHR Outage",
        "icon": "🛡️",
        "banner": "SYSTEMS OUTAGE: Hospital EHR systems offline. TriageWolf is now in Offline Protocol Mode - print your card before arriving.",
        "description": "Hospital electronic health records offline. Facilities with offline protocols preferred. Patients receive printable triage cards for paramedic / nurse handoff.",
        "wait_multipliers": {
            "Hospital ER": {"queue_mult": 2.2, "service_mult": 1.4},
            "Urgent Care": {"queue_mult": 1.8, "service_mult": 1.3},
            "Walk-in Clinic": {"queue_mult": 1.5, "service_mult": 1.2},
            "Telehealth": {"queue_mult": 0.8, "service_mult": 1.0},
        },
        "routing": {
            "promote_virtual_for_ctas_ge": 4,
            "prefer_offline_capable": True,
            "offline_mode": True,
        },
        "patient_advice": "Bring photo ID, your medication list, and the QR card you generated here. Staff will scan it manually if EHR is down.",
    },
}


def get_active_scenario(state: dict):
    key = state.get("active_scenario")
    if key and key in SCENARIOS:
        return key, SCENARIOS[key]
    return None, None


def multipliers_for(facility, state: dict):
    key, scen = get_active_scenario(state)
    if not scen:
        return {"queue_mult": 1.0, "service_mult": 1.0}
    return scen["wait_multipliers"].get(facility["type"], {"queue_mult": 1.0, "service_mult": 1.0})

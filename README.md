# BramHealth — Brampton Care Navigator

**WolfHacks 2026 · Health Resilience Task Force**
**Live:** [bramhealth.vercel.app](https://bramhealth.vercel.app)

> *The year is 2030. Brampton's healthcare system is at a breaking point — rapid population growth, long ER wait times, unequal access across communities, rising mental health needs, and Condition X. You've been called to the Health Resilience Task Force.*

---

## What It Does

BramHealth is an AI-powered clinical navigation platform that matches patients to the fastest available care in Brampton in seconds. It uses the **Canadian Triage and Acuity Scale (CTAS)**, live wait-time modelling, and an ML early-detection layer to catch cardiac, stroke, sepsis, and anaphylaxis patterns before they become obvious — then routes patients to the right facility.

It works in normal conditions **and** holds up under Condition X, heatwave, and cyberattack scenarios.

---

## Brampton 2040 Vision: Living the Mosaic

All four pillars of Brampton's 2040 Vision are addressed:

| Pillar | How BramHealth delivers |
|---|---|
| **Health & Well-Being** | CTAS triage + ML early detection + Active Living wait-time exercise tracker |
| **Social Inclusion & Equity** | Equal routing across all FSAs, transparent scoring formula, bias-auditable decisions |
| **Community-Based Living** | Walk-in, pharmacy, telehealth, and mobile clinic options — care brought to neighbourhoods |
| **Technology & Resilience** | Surge modes for Condition X, heatwave, and EHR cyberattack; offline QR handoff cards |

---

## Challenge Pillars Covered

### Health & Wellness + Active Living
- CTAS 1–5 triage with demographic adaptation (pediatric, geriatric, pregnancy, chronic conditions)
- ML Bayesian pattern detection: cardiac, stroke, sepsis, anaphylaxis
- Active Living tracker during wait times (pose-recognition exercise prompts)
- Preventative care routing: telehealth and walk-in before ER for non-critical cases

### Community Access & Mental Health
- Full mental health screening module with DSM-5-informed CRISIS/URGENT/SUPPORT/MINOR classification
- Anonymous youth-safe chat interface
- Routes to 9-8-8, Kids Help Phone, TELUS Health MyCare, partner pharmacies
- Caregiver/family triage mode — parents triaging children, kids triaging elderly parents

### Health Data, Ethics & Equity
- Transparent scoring: severity 50% + wait 30% + proximity 20% — shown to every patient
- "Why this rating?" drawer exposes the full decision pipeline (CTAS rules → ML patterns → demographic modifiers)
- PHIPA-aligned: no PII stored server-side; session tokens are ephemeral
- Inclusive design: voice input, plain-language symptom descriptions, accessibility mode

---

## Adaptability: Condition X & Surge Scenarios

BramHealth is designed to remain reliable when the system is under extreme pressure:

| Scenario | What changes |
|---|---|
| **Condition X** (artificial plague) | ER queue ×3.0 surge; virtual care promoted for CTAS ≥ 3; patient outbreak advice shown |
| **Heatwave** | AC-equipped facilities preferred; seniors and chronic-condition patients prioritised |
| **Cyberattack / EHR Outage** | Offline protocol mode; printable QR handoff cards; telehealth promoted |

---

## STEAM Integration

- **Science:** CTAS clinical standard (Canadian ED acuity scale); Bayesian co-occurrence probability for early pattern detection
- **Technology:** Flask + OpenAI GPT-4o-mini AI assistant; TensorFlow.js client-side ML; Web Speech API voice input; Leaflet.js real-time maps
- **Engineering:** M/M/c queueing model for wait-time prediction; facility capability matching (stroke centre, pediatric, obstetric, trauma); FSA-based proximity ranking

---

## Core Features

- **AI triage assistant** — describe symptoms in plain words or speak; auto-fills the form
- **Live wait times** — M/M/c queueing approximation, updates every 60 seconds
- **Facility matching** — ranks Hospital ER, Urgent Care, Walk-in, and Telehealth by severity + wait + distance
- **Early detection** — ML flags cardiac, stroke, sepsis, anaphylaxis patterns before CTAS alone would
- **Caregiver mode** — family triage for children, elderly parents, neighbours
- **QR handoff card** — scan at reception skips intake; staff see CTAS level + symptoms + ML flags instantly
- **Mental health module** — crisis screening, youth support, stigma-free intake
- **Operations dashboard** — live severity distribution, facility saturation, triage volume trend
- **Interactive map** — all Brampton facilities with real-time wait overlays
- **Surge scenarios** — Condition X, heatwave, cyberattack with one-click activation

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Python · Flask |
| Triage engine | Custom CTAS rules + Bayesian ML (`triage_engine.py`) |
| AI assistant | OpenAI GPT-4o-mini (`ai_assistant.py`) |
| Frontend | Jinja2 templates · Vanilla JS · Tailwind-inspired design system |
| Maps | Leaflet.js |
| Deployment | Vercel (`vercel.json`) |

---

## Judging Criteria Alignment

| Criterion (25% each) | Evidence |
|---|---|
| **Problem Relevance & STEAM** | CTAS clinical standard; M/M/c queuing; Bayesian ML; real Brampton facility data |
| **Prototype Functionality** | Fully working: triage → results → maps → dashboard → mental health → emergency response |
| **Adaptability** | 3 surge scenarios (Condition X, heatwave, cyberattack); offline QR fallback |
| **Presentation** | `/features` overview, `/pitch` deck, `/impact` — Why Brampton page |

---

## Running Locally

```bash
pip install -r requirements.txt
OPENAI_API_KEY=sk-... flask run
```

Open [http://localhost:5000](http://localhost:5000).

---

*BramHealth is a clinical navigation tool, not medical advice. If you suspect an emergency, call 911 immediately.*

# Automedic — Diagnostic Assistant — Project Plan

## Overview

A professional **Edge-to-Cloud Diagnostic Ecosystem** that bridges real-world conversations and structured medical data. The UI serves as a "Single Pane of Glass" for clinicians, with placeholders for Arduino audio, vision (OpenCV/YOLO), Speech-to-Text (Whisper), and Clinical BERT for ICD-10/NER.

---

## Architecture Summary

| Layer | Component | Status |
|-------|-----------|--------|
| **Edge** | Arduino/ESP32 + high-gain mic | Placeholder (UI shows "listening" state) |
| **Vision** | Camera + OpenCV/YOLO → text observations | Placeholder (UI shows vision activity log) |
| **Processing** | FastAPI backend: STT, merge streams | Placeholder (mock WebSocket/API) |
| **Intelligence** | Clinical BERT → NER, ICD-10, DDx | Placeholder (mock responses) |
| **UI** | React + TypeScript + Vite | Full implementation |

**Data flow:** Capture → Synthesis (audio→transcript, video→observations) → Fuse narrative → BERT inference → UI (diagnosis, codes, insights).

---

## Phase 1 — Project Setup & Shell

### 1.1 Repository structure

- `backend/` — FastAPI app, WebSocket for live transcription, REST for encounter/diagnosis.
- `frontend/` — React 18 + TypeScript + Vite, Tailwind CSS.
- `docs/` — API spec, integration notes (optional).
- Root: `README.md`, `PROJECT_PLAN.md`, `.env.example`.

### 1.2 Backend scaffold

- Python 3.11+, venv, `requirements.txt`.
- FastAPI app with CORS, health check, router modules.
- Env: `API_HOST`, `PORT`, `ALLOWED_ORIGINS`; later `OPENAI_WHISPER_*`, `BERT_MODEL_PATH`, etc.

### 1.3 Frontend scaffold

- Vite + React + TypeScript, Tailwind, React Router.
- Layout: app shell, sidebar/nav, main content area.
- Theme: clinical, minimal wording, high contrast, clear hierarchy.

### 1.4 Deliverables

- [ ] Monorepo with `backend/` and `frontend/` runnable locally.
- [ ] Single shared layout and routing (e.g. `/`, `/encounter`, `/dashboard`).

---

## Phase 2 — Active Encounter View (Real-Time)

### 2.1 Live transcription feed

- Scrolling text area showing real-time "Speech-to-Text" (mock or WebSocket).
- Auto-scroll to bottom, optional pause-scroll.
- Accessible, readable font and contrast.

### 2.2 Audio visualizer

- Small waveform or pulse icon indicating "system listening."
- States: idle, listening, paused (privacy).
- Placeholder for future Arduino/stream link.

### 2.3 Quick-tag highlights

- As "symptoms" or key terms are recognized, highlight them in the transcript (e.g. "chest pain").
- Use a distinct, non-distracting style (e.g. subtle background + label).
- Data from mock "key vitals" / NER (placeholder).

### 2.4 Privacy toggle

- Prominent "Pause / Mute" button to stop capture and processing for sensitive parts.
- Visual state: Recording vs Paused; clear label for HIPAA transparency.

### 2.5 Ambient sidebar (live input)

- Audio visualizer in sidebar.
- Vision activity log: lines such as *"Detected: Patient wincing (right side abdominal pain)"* (mock).
- "Session Active" indicator.

### 2.6 Deliverables

- [ ] Encounter page with all above elements.
- [ ] "End Encounter" button that transitions to dashboard (state/route).

---

## Phase 3 — Post-Diagnostic Dashboard (Analysis)

### 3.1 Split-screen layout

- Left: **Diagnostic Summary** panel.
- Right: **Clinical Plan** panel.
- Responsive: stack on small screens.

### 3.2 Diagnostic Summary panel

- **Chief complaint:** Bold, auto-generated headline (mock).
- **AI-suggested diagnoses:** Ranked list with:
  - Confidence score (e.g. 85%) — required.
  - "Why this?" tooltip/hover: show transcript snippet that triggered suggestion (explainability).
- **ICD-10 code selector:** Searchable dropdown, pre-filled from suggested diagnoses (mock list).

### 3.3 Clinical Plan panel

- **Suggested treatments:** Medication, dosage, frequency (mock).
- **Labs/imaging orders:** One-click actions (e.g. "Order X-Ray", "Order CBC") — UI only or mock API.
- **Patient-friendly summary:** Plain-language explanation (e.g. "Heart Attack") and simple recovery steps.

### 3.4 BERT analysis center (diagnosis block)

- Clinical summary (Subjective/Objective) from merged narrative (mock).
- Top 3 predicted diagnoses with confidence percentages.
- ICD-10 mapping: codes as links (e.g. open official docs in new tab).

### 3.5 Deliverables

- [ ] Dashboard route and layout.
- [ ] All panels implemented with mock data.
- [ ] Explainability: hover diagnosis → highlight source text in transcript.

---

## Phase 4 — EMR Integration & Data Integrity UI

### 4.1 Sync to chart

- "Sync to Chart" button: sends structured data (vitals, codes, notes) to "EMR" (mock).
- Confirmation step (e.g. modal) before sync.
- Success/error feedback.

### 4.2 Edit/verify mode

- Every AI-generated field editable (inline or modal).
- "AI proposes, human disposes": clear Accept/Edit affordances.
- Small "Accept / Edit" icon or control per field.

### 4.3 Validation / conflict alerts

- If contradiction detected (e.g. penicillin allergy + Amoxicillin suggested): **Conflict Alert** (red).
- Non-blocking but prominent; allow override after review.

### 4.4 Deliverables

- [ ] Sync to Chart flow with confirmation.
- [ ] Editable fields across Summary and Clinical Plan.
- [ ] Conflict alert component and wiring (mock trigger).

---

## Phase 5 — Technical Components & Polish

### 5.1 JSON previewer

- Developer view: show how "speech → structured data" looks (e.g. transcript + extracted entities, ICD-10).
- Collapsible panel or tab so it doesn’t clutter the main clinician view.

### 5.2 Confidence gauges

- Visual bars (or similar) for confidence per ICD-10 code or per diagnosis.
- Consistent with confidence percentages in the summary.

### 5.3 Timeline view

- Sidebar or panel: "Patient history" from EMR (mock list of past encounters/events).
- Small, scannable timeline.

### 5.4 Multilingual toggle

- Button to switch **Patient-Friendly Summary** language (e.g. EN, ES, etc.).
- Mock translation or placeholder text.

### 5.5 Out-of-the-box insights (helpful peer)

- **Differential diagnosis (DDx) alerts:** e.g. "Consider: Viral Gastritis vs Appendicitis given fever duration."
- **Evidence links:** UpToDate/BMJ-style links (mock URLs).
- **Drug interaction check:** Red/green flag when med mentioned (e.g. Warfarin + NSAID warning).
- Color coding: red = critical, blue = informational.

### 5.6 Traceability view (demo)

- Optional view: show how a gesture (e.g. "holding chest") + transcript word ("heaviness") led to "Myocardial Infarction."
- For hackathon demo; can be a separate route or expandable section.

### 5.7 Deliverables

- [ ] JSON previewer panel.
- [ ] Confidence gauges on dashboard.
- [ ] Timeline sidebar with mock history.
- [ ] Language toggle for patient summary.
- [ ] DDx, evidence, and drug-interaction UI elements.
- [ ] Traceability view (optional).

---

## Phase 6 — Backend APIs & Placeholders

### 6.1 REST endpoints

- `POST /api/encounters` — Start encounter (returns `encounter_id`).
- `POST /api/encounters/{id}/end` — End encounter; trigger mock "analysis."
- `GET /api/encounters/{id}` — Encounter + transcript + analysis (mock).
- `GET /api/encounters/{id}/diagnosis` — Suggested diagnoses, ICD-10, confidence (mock).
- `POST /api/encounters/{id}/sync` — Sync to EMR (mock).
- `GET /api/patients/{id}/timeline` — Patient history timeline (mock).

### 6.2 WebSocket

- `WS /api/ws/transcription` — Live transcript chunks (mock stream).
- Optional: `WS /api/ws/vision` — Vision activity log messages (mock).

### 6.3 Placeholder modules (no real models/hardware)

- `backend/services/stt.py` — Whisper placeholder; return mock transcript.
- `backend/services/vision.py` — OpenCV/YOLO placeholder; return mock observations.
- `backend/services/bert_inference.py` — Clinical BERT placeholder; return mock NER, ICD-10, DDx.
- `backend/services/arduino_client.py` — Arduino/ESP32 stream placeholder (optional).

### 6.4 Deliverables

- [ ] All above endpoints implemented with mock data.
- [ ] WebSocket for live transcription (mock).
- [ ] Placeholder services documented; clear insertion points for real STT/BERT/vision/hardware.

---

## Task Checklist (Structured)

| Phase | Task ID | Task | Owner |
|-------|---------|------|--------|
| 1 | 1.1 | Create repo structure, README, .env.example | — |
| 1 | 1.2 | Backend: FastAPI app, CORS, health, routers | — |
| 1 | 1.3 | Frontend: Vite+React+TS+Tailwind, layout, routes | — |
| 2 | 2.1 | Live transcription feed component | — |
| 2 | 2.2 | Audio visualizer component | — |
| 2 | 2.3 | Quick-tag highlights in transcript | — |
| 2 | 2.4 | Privacy (Pause/Mute) toggle | — |
| 2 | 2.5 | Ambient sidebar (visualizer + vision log) | — |
| 2 | 2.6 | End Encounter → navigate to dashboard | — |
| 3 | 3.1 | Dashboard split-screen layout | — |
| 3 | 3.2 | Diagnostic Summary (complaint, diagnoses, ICD-10) | — |
| 3 | 3.3 | Clinical Plan (treatments, orders, patient summary) | — |
| 3 | 3.4 | BERT analysis block (summary, top 3, ICD-10 links) | — |
| 3 | 3.5 | Explainability: hover → highlight transcript | — |
| 4 | 4.1 | Sync to Chart button + confirmation | — |
| 4 | 4.2 | Edit/Verify for all AI fields | — |
| 4 | 4.3 | Validation/conflict alert component | — |
| 5 | 5.1 | JSON previewer panel | — |
| 5 | 5.2 | Confidence gauges | — |
| 5 | 5.3 | Timeline view (patient history) | — |
| 5 | 5.4 | Multilingual toggle (patient summary) | — |
| 5 | 5.5 | DDx alerts, evidence links, drug interaction | — |
| 5 | 5.6 | Traceability view (optional) | — |
| 6 | 6.1 | REST API for encounters, diagnosis, sync, timeline | — |
| 6 | 6.2 | WebSocket transcription (mock) | — |
| 6 | 6.3 | Placeholder services (STT, vision, BERT, Arduino) | — |

---

## UI/UX Principles

- **Minimal wording:** Labels short and clear; tooltips for detail.
- **Self-descriptive:** Icons + text; states (Listening, Paused, Synced) obvious.
- **Human-in-the-loop:** Every AI field has Accept/Edit; no auto-save of AI content without review.
- **Alert hierarchy:** Red = critical (e.g. conflict); Blue = informational (e.g. "Consider DDx").
- **Explainability:** Hover diagnosis → see source transcript; traceability view for demo.

---

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router.
- **Backend:** Python 3.11+, FastAPI, WebSockets, Uvicorn.
- **Future:** Whisper (STT), Clinical BERT (PyTorch/Transformers), OpenCV/YOLO, Arduino/ESP32 (placeholders only in this plan).

---

## Running the Project

- **Backend:** `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload`
- **Frontend:** `cd frontend && npm install && npm run dev`
- **Env:** Copy `.env.example` to `.env` and set `ALLOWED_ORIGINS` (e.g. `http://localhost:5173`).

---

*Document version: 1.0 — Last updated: Feb 2025*

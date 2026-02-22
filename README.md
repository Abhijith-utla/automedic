# Automedic — Diagnostic Assistant

Professional **Edge-to-Cloud Diagnostic Ecosystem** for real-time encounter capture and AI-assisted diagnosis. The UI bridges "messy" real-world conversations and structured medical data.

## Features

- **Landing page:** Big logo and Sign in / Register. After sign-in, doctors see their patient list.
- **Patients:** Doctor-specific patient list (cards); add patients with name, DOB, MRN, notes. Click a patient to see detail and history (past EMR/encounters).
- **Encounter flow:** From a patient, "Start encounter" → live transcription, camera + microphone capture, optional wound screenshot analysis, privacy toggle, ambient sidebar. "End encounter" saves transcript and runs triage/care-plan pipeline.
- **Post-diagnostic dashboard:** Diagnostic Summary, Clinical Plan, Sync to Chart (with confirmation), Edit/Verify, conflict alerts, JSON previewer, timeline, multilingual patient summary, DDx/evidence/drug insights.
- **Database:** SQLite store for users (doctors), patients (per doctor), and encounters (transcript, diagnosis, EMR). All encounter/EMR data is persisted; timeline is built from stored encounters.
- **Auth:** Register and sign in with email/password; session cookie (JWT in HTTPOnly cookie).

Backend and ML/hardware are modular integration points (FastAPI + DB + model pipeline + device/vision endpoints).

## Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.10+

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. **Register** or **Sign in** → **Add patient** → open a patient → **Start encounter** → **End encounter** → review dashboard and **Sync to chart**.

### 3. AI diagnosis model (Ollama)

```bash
ollama serve
ollama pull mistral
```

### 4. Environment

Create `/Users/abhijithutla/projects/Automedic/backend/.env` and configure provider/model keys if needed.

## Research dataset links (kept from previous repo history)

Pain:
- https://borealisdata.ca/dataset.xhtml?persistentId=doi:10.5683/SP3/WCXMAP
- https://osf.io/3hgca/overview?view_only=12b04cd8164d4a6784c04b8c83bf95fb

Stress:
- https://data.mendeley.com/datasets/t93xcwm75r/12
- https://www.kaggle.com/datasets/janithukwattage/stress-faces-dataset

Emotions:
- https://www.kaggle.com/datasets/deadskull7/fer2013

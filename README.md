# Automedic — Diagnostic Assistant

Professional **Edge-to-Cloud Diagnostic Ecosystem** for real-time encounter capture and AI-assisted diagnosis. The UI bridges "messy" real-world conversations and structured medical data.

## Features

- **Landing page:** Big logo and Sign in / Register. After sign-in, doctors see their patient list.
- **Patients:** Doctor-specific patient list (cards); add patients with name, DOB, MRN, notes. Click a patient to see detail and history (past EMR/encounters).
- **Encounter flow:** From a patient, "Start encounter" → live transcription (mock), audio visualizer, quick-tag highlights, privacy toggle, ambient sidebar. "End encounter" saves transcript and runs mock diagnosis, then opens the post-encounter dashboard.
- **Post-diagnostic dashboard:** Diagnostic Summary, Clinical Plan, Sync to Chart (with confirmation), Edit/Verify, conflict alerts, JSON previewer, timeline, multilingual patient summary, DDx/evidence/drug insights.
- **Database:** SQLite store for users (doctors), patients (per doctor), and encounters (transcript, diagnosis, EMR). All encounter/EMR data is persisted; timeline is built from stored encounters.
- **Auth:** Register and sign in with email/password; session cookie (JWT in HTTPOnly cookie).

Backend and ML/hardware are **placeholders** (FastAPI + DB + mock diagnosis; ready for Whisper, Clinical BERT, vision, Arduino).

## Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.11+

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. **Register** or **Sign in** → **Add patient** → open a patient → **Start encounter** → watch live transcription (mock) → **End encounter** → review dashboard and **Sync to chart**. Data is stored in `backend/automedic.db` (SQLite).

### 3. Environment (optional)

- Backend: copy `backend/.env.example` to `backend/.env` and set `CORS_ORIGINS` if needed.
- Frontend: no env required; API is proxied to `http://localhost:8000`.

### 4. AI diagnosis model — for "Run diagnosis"

The **Run diagnosis** button and clinical-report API use a two-agent pipeline (triage + care plan) using **Mistral**. Report data comes only from the model output (no mock/demo).

Choose one provider:

1. **Ollama (local)**

   - **Install Ollama:** https://ollama.com/download (or `curl -fsSL https://ollama.com/install.sh | sh`)
   - **Start Ollama** (app or `ollama serve`)
   - **Pull the model** (one-time download):
   ```bash
   ollama pull mistral
   ```

2. **Featherless (API)**

   Set backend env variables:
   ```bash
   LLM_PROVIDER=featherless
   FEATHERLESS_API_KEY=your_key_here
   TRIAGE_PIPELINE_TRIAGE_MODEL=mistral
   TRIAGE_PIPELINE_CARE_MODEL=mistral
   ```

See **[backend/scripts/README.md](./backend/scripts/README.md)** for full details.

## Project plan

See **[PROJECT_PLAN.md](./PROJECT_PLAN.md)** for phases, architecture, task checklist, and integration points (STT, BERT, vision, Arduino).

## Tech stack

| Layer   | Stack |
|--------|--------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| Backend  | FastAPI, WebSockets, Pydantic |
| Future   | Whisper (STT), Clinical BERT, OpenCV/YOLO, Arduino/ESP32 (placeholders only) |

## License

MIT (or as specified in the repo).

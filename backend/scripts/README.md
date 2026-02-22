# Seed mock patients (seed_patients.py)

Seeds the database with mock patients (with avatar photos) and past encounter records.

- **Requirement:** At least one user must be registered (e.g. via the app). Patients are assigned to the first user in the DB.
- **Run from the backend directory:**  
  `python -m scripts.seed_patients`
- Creates 8 mock patients with random names, DOB, MRN, email, phone, and a unique avatar photo URL (DiceBear). Each patient gets 2–5 past encounters with varied chief complaints and dates over the last ~6 months.
- If you already have patients, the script skips seeding. To clear and re-seed with the full mock set, run: `python -m scripts.seed_patients --force`

---

# Clinical agents (Mistral pipeline)

The **Run diagnosis** flow uses the **Ministral** model via the in-process triage pipeline (`app.services.triage_pipeline`):

- **Agent 1 (Triage):** Mistral — vitals, NEWS2, severity, differential diagnoses, thought process (JSON).
- **Agent 2 (Care plan):** Mistral — treatment plan, medications, lab tests, ICD-10 codes, next visit (JSON).

Report data comes **only from the agent output**; there is no mock or demo mode.

## Provider setup (Mistral)

Pick one provider for the pipeline.

### Option A: Ollama (local)

The pipeline runs locally via Ollama. Install Ollama and pull the model before "Run diagnosis".

1. Install Ollama

- **macOS/Linux:** https://ollama.com/download  
- Or: `curl -fsSL https://ollama.com/install.sh | sh`

2. Start Ollama

- Open the Ollama app (macOS/Windows) or run: `ollama serve`
- It listens at `http://localhost:11434`

3. Pull the model

```bash
ollama pull mistral
```

Verify: `ollama list` — you should see `mistral`.

### Option B: Featherless (API)

Set backend environment variables:

```bash
LLM_PROVIDER=featherless
FEATHERLESS_API_KEY=your_key_here
TRIAGE_PIPELINE_TRIAGE_MODEL=mistral
TRIAGE_PIPELINE_CARE_MODEL=mistral
```

### Optional (for agent chaining)

```bash
pip install langchain-ollama
```

---

## Input

- **4–5 sentence summary** of the doctor–patient conversation (video/audio transcript or hardware findings).
- Pass via stdin or as first argument: `python almost.py "Patient presents with..."`
- The API truncates long input to ~500 characters so the model finishes in reasonable time.

## Output

- With `--json`: prints one combined JSON object to stdout (used by the API).
- Without: prints human-readable sections to stdout.

## Requirements (summary)

- **Model:** `mistral` for both triage and care-plan agents.
- **Provider:** either Ollama local or Featherless API (configured above).
- Optional: `pip install langchain-ollama` for full agent chaining.

## Flow (summary → graphics)

1. **Input:** 4–5 sentence clinical summary (e.g. from encounter transcript).
2. **Agent 1 (Triage):** Mistral produces severity, differentials, assessment.
3. **Agent 2 (Care plan):** Mistral produces treatment, meds, labs, ICD-10, diet, next visit (JSON).
4. **Parser/mapper step:** The backend normalizes agent output into structured JSON for the dashboard (charts, cards, tables).

## API integration

The backend calls this script when you `POST /api/clinical-report` with a `paragraph` (and optional `encounter_id`). The result is parsed by the **parser agent** into dashboard-ready JSON and stored; the frontend **Journey** dashboard displays it (Triage, Labs, Care plan, ICD codes, Lifestyle).

To use a different script path (e.g. your local copy from Downloads), set:

```bash
export CLINICAL_SCRIPT_PATH=/path/to/almost.py
```

## Hardware/socket flow

1. Your hardware or socket service collects clinical text.
2. Call `POST /api/clinical-report` with `{ "paragraph": "<text>", "encounter_id": "<id>" }`.
3. The dashboard at `/encounter/<id>/journey` will show the report once stored.

---

## Speed and performance

The agents are tuned to run **faster** while keeping clinical quality:

- **Triage + Care plan:** run on local `mistral` through Ollama.
- **Token limits:** caps are set to keep responses concise and reduce latency.

### Environment variables (optional)

| Variable | Default | Effect |
|----------|--------|--------|
| `LLM_PROVIDER` | `ollama` | `ollama` (local) or `featherless` (API). |
| `FEATHERLESS_API_KEY` | (unset) | Required when `LLM_PROVIDER=featherless`. |
| `TRIAGE_PIPELINE_TRIAGE_MODEL` | `mistral` | Triage model (keep as `mistral` for this app). |
| `TRIAGE_PIPELINE_CARE_MODEL` | `mistral` | Care-plan model (keep as `mistral` for this app). |
| `OLLAMA_NUM_CTX` | (unset) | Cap context size (e.g. `4096`) to reduce memory and speed up. |

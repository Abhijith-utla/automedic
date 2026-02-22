# Where Automedic Fits in the Axxess Pipeline

**Automedic** is an AI-driven **Diagnostic Assistant** for real-time encounter capture and structured clinical output. Below is where it sits in Axxess’s care-at-home ecosystem and how it adds value.

---

## Primary Fit: Point-of-Care (Step 3) + Axxess Intelligence (Step 4)

| Axxess pipeline stage | Automedic role |
|------------------------|----------------|
| **3. Clinical point-of-care** | **Live encounter capture** at the patient’s home: real-time transcription, key-term tagging, and privacy controls. Clinician sees a single “pane” while talking to the patient. |
| **4. QA & compliance (Axxess Intelligence)** | **Structured output** for documentation: chief complaint, AI-suggested diagnoses with confidence and explainability, ICD-10 mapping, clinical plan, and conflict/allergy alerts. Feeds into narratives and reduces incomplete or inconsistent documentation. |

Automedic acts as a **clinical capture + AI layer** that sits **between** the bedside visit and the EMR/QA layer: it turns the conversation and context into structured, auditable data that Axxess can validate and bill on.

---

## How It Adds to Axxess

### 1. Richer point-of-care documentation (Step 3)

- **Today:** Clinicians document in the Axxess app with real-time validations and form scrubbers.
- **With Automedic:** The visit is **captured as it happens** (speech → transcript, optional device/vitals from Raspberry Pi). Key findings (symptoms, vitals) are highlighted so nothing is missed. The clinician can focus on the patient while the system builds the “raw” clinical story.
- **Value:** Fewer missed details, less recall bias, and a clear link from “what was said” to “what was documented.”

### 2. Stronger clinical intelligence (Step 4 – Axxess Intelligence)

- **Today:** Axxess Intelligence supports narratives and predictive analytics (e.g. re-hospitalization risk).
- **With Automedic:** A dedicated **diagnostic layer** that:
  - Proposes **differential diagnoses** with confidence and **explainability** (which part of the transcript or observation led to each suggestion).
  - Maps to **ICD-10** and suggests **clinical plan** (treatments, labs, imaging).
  - Surfaces **conflicts** (e.g. allergy vs suggested med) and **drug interactions** at point-of-care.
- **Value:** Faster, more consistent clinical reasoning; better alignment with HOPE/OASIS and Medicare documentation requirements; fewer denials and rework.

### 3. “Sync to chart” into Axxess EMR (Step 3 → 5)

- Automedic’s **“Sync to chart”** pushes structured data (vitals, codes, notes, plan) into the **operational backbone**.
- **Integration target:** Axxess Home Health or Hospice EMR as the system of record. Automedic becomes the **input device** for the visit; Axxess remains the source of truth for scheduling, RCM, and compliance.
- **Value:** One-time entry at point-of-care; automated flow into QA and billing (Step 5), with claim-ready codes and narratives.

### 4. Edge and device data (Raspberry Pi / future hardware)

- Automedic already has a **device WebSocket** for Raspberry Pi (vitals, audio, sensors).
- **Fit:** Home health and hospice visits often use devices (vitals, sometimes continuous monitoring). Automedic can ingest that stream and fuse it with the transcript and AI output before sending to Axxess.
- **Value:** Device data is in the same workflow as the narrative and diagnosis, so Axxess gets a single, coherent clinical picture per visit.

---

## Where It Sits in the Pipeline (Visual)

```
[Referral / Intake]     →  Axxess Exchange (unchanged)
[Staffing / Routes]     →  Axxess CARE (unchanged)
[Visit at home]         →  Clinician + Automedic (live capture, AI assist)
                              ↓
[Structured output]     →  Sync to Axxess EMR (Home Health / Hospice)
                              ↓
[QA & compliance]       →  Axxess Intelligence + HOPE/OASIS scrubbers (use our output)
[Billing]               →  Axxess RCM (claims from our codes + documentation)
```

Automedic does **not** replace intake, scheduling, RCM, or training; it **feeds** the EMR and Intelligence layers with higher-quality, structured encounter data.

---

## Positioning vs. Current Axxess Solutions

| Axxess product | Relationship to Automedic |
|----------------|----------------------------|
| **Axxess Home Health / Hospice** | **Target EMR** for “Sync to chart.” Automedic is an encounter-capture and AI front-end; the chart lives in Axxess. |
| **Axxess Intelligence** | **Complement.** Automedic adds encounter-level diagnostic AI (differential, ICD-10, conflicts); Axxess Intelligence keeps predictive analytics, QA automation, and narrative help. |
| **Axxess CARE** | **No direct overlap.** CARE is staffing; Automedic is documentation and diagnosis at the visit. |
| **Axxess CAHPS** | **No direct overlap.** Automedic could eventually inform “what was addressed this visit” for satisfaction or quality reporting, but that’s a later integration. |

---

## Summary

- **Where it fits:** **Point-of-care documentation (Step 3)** and **clinical intelligence / QA (Step 4)**, with a clear handoff to the **EMR and RCM (Steps 3–5)**.
- **How it adds value:** Real-time encounter capture, AI-assisted diagnosis with explainability, conflict and drug checks, ICD-10 and plan suggestions, and one-click sync into the Axxess backbone so documentation is complete, consistent, and claim-ready.
- **Integration approach:** Automedic as the **capture + AI layer**; Axxess Home Health or Hospice as the **record and billing system**, with APIs or HL7/FHIR for “Sync to chart” and optional device data from the Pi or other edge devices.

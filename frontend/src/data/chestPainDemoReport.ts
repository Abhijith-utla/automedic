import type { ChestPainLabeledReport } from "@/types/chestPainLabeled";

export const chestPainDemoReport: ChestPainLabeledReport = {
  case_summary: {
    case_id: "DEMO-001",
    paragraph_summary:
      "A patient presents to ED triage with central chest pain of approximately 2 hours duration, described as heavy and pressured. Vital signs are within normal limits. Anxiety is noted as a contributing factor alongside limited mobility. Initial acuity is low based on NEWS2 score of 0.",
    encounter_type: "ED Triage",
    acuity_level: "Low",
    time_since_onset_hours: 2,
    red_flag_present: false,
  },

  vitals_risk: {
    vitals: {
      heart_rate: 82,
      respiratory_rate: 16,
      blood_pressure_systolic: 138,
      blood_pressure_diastolic: 88,
      oxygen_sat: 98,
      temperature: 36.8,
      consciousness: "Alert",
      on_oxygen: false,
    },
    news2: {
      total_score: 0,
      risk_level: "Low",
      urgency: "Low",
      action_required: "Routine monitoring; reassess if clinical status changes.",
      component_scores: {
        respiratory_rate: { score: 0, label: "RR 16 – within normal range" },
        oxygen_sat: { score: 0, label: "SpO₂ 98% – normal" },
        blood_pressure_systolic: { score: 0, label: "BP 138 – normal range" },
        heart_rate: { score: 0, label: "HR 82 – normal" },
        temperature: { score: 0, label: "Temp 36.8°C – normal" },
        consciousness: { score: 0, label: "Alert – AVPU A" },
      },
    },
  },

  triage: {
    chief_complaint: "Central chest pain – heaviness, 2 hours duration",
    symptom_features: [
      { name: "Central chest pain", duration_hours: 2, severity: "moderate", modifiers: ["heaviness", "pressure"] },
      { name: "Anxiety", severity: "mild", modifiers: ["situational"] },
      { name: "Limited mobility", severity: "mild", modifiers: ["pain-related"] },
    ],
    concerning_findings: ["Central location of pain", "Duration > 30 mins"],
    risk_factors: ["No cardiac history", "Anxiety", "Sedentary lifestyle"],
  },

  differentials: {
    differentials: [
      {
        diagnosis: "Musculoskeletal chest wall pain",
        category: "Musculoskeletal",
        reasoning:
          "Patient was observed holding chest centrally, mobility is limited, and pain character is consistent with costochondritis or intercostal muscle strain. No shortness of breath or diaphoresis.",
        estimated_likelihood: "likely",
        supporting_features: ["Chest holding", "Limited mobility", "No SOB", "No diaphoresis"],
      },
      {
        diagnosis: "Anxiety-related chest symptoms",
        category: "Psychogenic",
        reasoning:
          "Significant anxiety is noted throughout the encounter. Psychogenic chest pain can mimic cardiac symptoms and is supported by the absence of ECG changes and normal troponin.",
        estimated_likelihood: "possible",
        supporting_features: ["Anxiety", "Normal vitals", "No ECG changes"],
      },
      {
        diagnosis: "Atypical angina",
        category: "Cardiac",
        reasoning:
          "Cannot be fully excluded without ECG and troponin results. Patient age and absence of risk factors lower probability.",
        estimated_likelihood: "unlikely",
        supporting_features: ["Central pain location", "Pressure character"],
      },
    ],
  },

  workup: {
    investigations: [
      { type: "ECG", name: "12-lead ECG", purpose: "Rule out ST-elevation, arrhythmia", priority: "Urgent", fasting_required: false },
      { type: "Imaging", name: "Chest X-ray", purpose: "Exclude pneumothorax, cardiomegaly", priority: "Routine", fasting_required: false },
      { type: "Lab", name: "High-sensitivity Troponin", purpose: "Rule out acute myocardial infarction", priority: "Urgent", fasting_required: false },
      { type: "Consult", name: "Cardiology consultation", purpose: "If troponin positive or ECG changes present", priority: "Routine", fasting_required: false },
    ],
    care_steps_ordered: [
      { step_number: 1, action: "Obtain 12-lead ECG immediately", trigger_condition: "On arrival" },
      { step_number: 2, action: "Draw blood for hs-Troponin, FBC, U&E", trigger_condition: "Concurrent with ECG" },
      { step_number: 3, action: "Initiate pain relief (paracetamol / ibuprofen)", trigger_condition: "If musculoskeletal etiology suspected" },
      { step_number: 4, action: "Urgent cardiology referral if ECG or troponin abnormal", trigger_condition: "Positive troponin or ST changes on ECG" },
    ],
  },

  medications: {
    medications: [
      {
        name: "Aspirin",
        dose: "300 mg",
        route: "Oral",
        frequency: "Single loading dose",
        indication: "Suspected ACS prophylaxis pending investigation",
        monitoring_points: ["GI tolerance", "Bleeding signs", "Allergy screen"],
        side_effect_category: "bleeding",
      },
      {
        name: "GTN spray",
        dose: "400 mcg",
        route: "Sublingual",
        frequency: "PRN chest pain",
        indication: "Vasodilatory relief for anginal pain",
        monitoring_points: ["Blood pressure", "Headache", "Do not use with PDE-5 inhibitors"],
        side_effect_category: "hypotension",
      },
      {
        name: "Paracetamol",
        dose: "1 g",
        route: "Oral",
        frequency: "Every 6 hours PRN",
        indication: "Analgesia for musculoskeletal chest pain",
        monitoring_points: ["Hepatic function if regular use", "Max 4g/24h"],
        side_effect_category: "nausea",
      },
    ],
  },

  icd_codes: {
    icd_codes: [
      { code: "R07.9", label: "Chest pain, unspecified", category: "Symptom", justification_symptoms: ["Central chest pain", "Heaviness"] },
      { code: "F41.1", label: "Generalised anxiety disorder", category: "Psych", justification_symptoms: ["Anxiety"] },
      { code: "M94.0", label: "Chondrocostal junction syndrome (Tietze)", category: "Musculoskeletal", justification_symptoms: ["Central chest pain", "Limited mobility", "Chest holding"] },
    ],
  },

  lifestyle_followup: {
    follow_up: {
      timeframe: "24 hours",
      reason:
        "Symptoms could still be cardiac or respiratory despite normal vitals. Return to ED immediately if pain worsens, shortness of breath develops, or palpitations begin.",
    },
    lifestyle_recommendations: [
      { type: "Diet", recommendation_text: "Balanced whole foods diet", target_condition: "Cardiac risk" },
      { type: "Diet", recommendation_text: "Avoid caffeine & alcohol", target_condition: "Anxiety" },
      { type: "Exercise", recommendation_text: "Daily walking (20–30 mins)", target_condition: "Chest pain" },
      { type: "Exercise", recommendation_text: "Gentle yoga or stretching", target_condition: "Musculoskeletal pain" },
      { type: "Sleep", recommendation_text: "7–8 hours/night sleep hygiene", target_condition: "Anxiety" },
      { type: "Relaxation", recommendation_text: "Deep breathing exercises", target_condition: "Anxiety" },
      { type: "Relaxation", recommendation_text: "Mindfulness meditation", target_condition: "Anxiety" },
      { type: "Substances", recommendation_text: "No smoking – cessation support", target_condition: "Cardiac risk" },
    ],
  },
};

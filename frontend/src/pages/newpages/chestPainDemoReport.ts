import type { ChestPainLabeledReport } from "@/types/chestPainLabeled";

/** Default clinical paragraph for demo / run model (hyperbilirubinemia case). */
export const DEFAULT_RUN_PARAGRAPH =
  "There is a clear yellow discoloration of the sclera and a diffuse yellow tint to the facial skin and upper extremities under normal lighting. The patient looks mildly fatigued but is alert and responsive. No obvious signs of acute distress are noted. There are no visible rashes or active bleeding. The patient reports darker-than-usual urine and generalized itching over the past few days. Overall presentation is consistent with hyperbilirubinemia and warrants further evaluation of liver function and possible biliary involvement.";

export const chestPainDemoReport: ChestPainLabeledReport = {
  case_summary: {
    case_id: "DEMO-001",
    paragraph_summary: DEFAULT_RUN_PARAGRAPH,
    encounter_type: "Outpatient",
    acuity_level: "Medium",
    time_since_onset_hours: undefined,
    red_flag_present: false,
  },

  vitals_risk: {
    vitals: {
      consciousness: "ALERT",
      on_oxygen: false,
    },
    news2: {
      total_score: 0,
      risk_level: "Low",
      urgency: "Low",
      action_required: "Routine monitoring",
      component_scores: {},
    },
  },

  triage: {
    chief_complaint: "Yellow discoloration of sclera and skin, itching, darker urine",
    symptom_features: [
      { name: "Jaundice (sclera & skin)", severity: "moderate", modifiers: ["generalized"] },
      { name: "Pruritus", severity: "mild", modifiers: ["generalized"] },
      { name: "Dark urine", severity: "mild", modifiers: [] },
      { name: "Mild fatigue", severity: "mild", modifiers: [] },
    ],
    concerning_findings: ["Possible jaundice", "Mild fatigue"],
    risk_factors: ["Possible liver dysfunction", "Potential biliary obstruction"],
  },

  differentials: {
    differentials: [
      {
        diagnosis: "Hyperbilirubinemia",
        category: "Metabolic",
        reasoning:
          "Yellow discoloration of sclera and facial skin, generalized itching, darker-than-usual urine.",
        estimated_likelihood: "likely",
        supporting_features: ["Scleral icterus", "Facial jaundice", "Pruritus", "Dark urine"],
      },
      {
        diagnosis: "Hepatobiliary disease",
        category: "GI",
        reasoning: "Potential biliary involvement",
        estimated_likelihood: "possible",
        supporting_features: ["Biliary involvement"],
      },
    ],
  },

  workup: {
    investigations: [
      {
        type: "Lab",
        name: "Complete Blood Count (CBC)",
        purpose: "To evaluate for anemia or infection",
        priority: "Routine",
        fasting_required: false,
      },
      {
        type: "Lab",
        name: "Liver Function Tests (LFTs)",
        purpose: "For assessment of liver function and bilirubin levels",
        priority: "Urgent",
        fasting_required: false,
      },
      {
        type: "Lab",
        name: "Urinalysis",
        purpose: "To evaluate urine color changes",
        priority: "Routine",
        fasting_required: false,
      },
    ],
    care_steps_ordered: [],
  },

  medications: {
    medications: [
      {
        name: "Prednisone",
        dose: "20mg daily for 5 days, then taper",
        route: "Oral",
        frequency: "Daily",
        indication: "For symptomatic relief of pruritus (itching)",
        monitoring_points: ["Taper as tolerated and symptoms improve"],
        side_effect_category: "immunosuppression",
      },
    ],
  },

  icd_codes: {
    icd_codes: [
      {
        code: "R12.09",
        label: "Hyperbilirubinemia, unspecified",
        category: "Symptom",
        justification_symptoms: ["Jaundice", "Dark urine", "Pruritus"],
      },
      {
        code: "K86.0",
        label: "Cholelithiasis (gallstones), unspecified",
        category: "GI",
        justification_symptoms: ["Potential biliary involvement"],
      },
    ],
  },

  lifestyle_followup: {
    follow_up: {
      timeframe: "In 2 days for reevaluation of symptoms and lab results.",
      reason: "Reevaluation of symptoms and lab results",
    },
    lifestyle_recommendations: [],
  },
};

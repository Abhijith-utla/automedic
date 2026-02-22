import type {
  DiagnosisData,
  AgentTriage,
  CarePlanStructured,
  AgentReport,
} from "@/api/client";

/**
 * Map diagnosis data (from API / agent report) into the shape expected by the Journey dashboard.
 */
export function diagnosisToJourneyData(diagnosis: DiagnosisData): AgentReport {
  const triage: AgentTriage = {
    severity_score: 3,
    is_red_flag: diagnosis.conflicts.length > 0,
    clinical_assessment:
      diagnosis.clinical_summary ||
      `${diagnosis.chief_complaint}. ${diagnosis.suggestions.map((s) => s.condition).join("; ")}.`,
    differential_diagnoses: diagnosis.suggestions.map((s) => ({
      diagnosis: s.condition,
      reasoning: s.source_snippet
        ? `Transcript: "${s.source_snippet}"`
        : `ICD-10 ${s.icd10_code}. Confidence ${Math.round(s.confidence * 100)}%.`,
    })),
    thought_process: [
      `Chief complaint: ${diagnosis.chief_complaint}`,
      diagnosis.conflicts.length
        ? `Concerning findings: ${diagnosis.conflicts.join("; ")}`
        : "Concerning findings: None noted.",
      "Vitals: From encounter (see chart).",
      `Top differentials: ${diagnosis.suggestions.slice(0, 3).map((s) => s.condition).join(", ")}.`,
      "Acuity: Based on suggested diagnoses and plan.",
    ],
    risk_factors: diagnosis.drug_interaction_flags?.map((f) => f.message) ?? [],
  };

  const meds = diagnosis.clinical_plan.filter((i) => i.type === "medication");
  const labs = diagnosis.clinical_plan.filter((i) => i.type === "lab" || i.type === "imaging");
  const treatmentSteps: string[] = [];
  meds.forEach((m) => {
    treatmentSteps.push(`${m.name} ${m.dosage || ""} ${m.frequency || ""}`.trim());
  });
  labs.forEach((l) => treatmentSteps.push(`Order: ${l.name}`));
  if (diagnosis.patient_summary?.steps?.length) {
    treatmentSteps.push(...diagnosis.patient_summary.steps);
  }

  const carePlan: CarePlanStructured = {
    treatment_steps: treatmentSteps.length ? treatmentSteps : ["Follow clinical plan above."],
    medications: meds.map((m) => ({
      name_dose: [m.name, m.dosage, m.frequency].filter(Boolean).join(" "),
      indication: "",
      monitor: "",
    })),
    lab_tests: labs.map((l) => ({
      name: l.name,
      reason: l.code ? `Code: ${l.code}` : "Per care plan",
      priority: "Routine",
      note: "",
    })),
    icd_codes: diagnosis.suggestions.map((s) => ({
      code: s.icd10_code,
      description: s.icd10_title || s.condition,
    })),
    diet_lifestyle: {
      recommendations: diagnosis.patient_summary?.steps ?? ["Follow provider instructions.", "Return if symptoms worsen."],
    },
    next_visit: diagnosis.patient_summary?.summary || "Follow up as directed by provider.",
  };

  return {
    paragraph_summary: diagnosis.chief_complaint,
    agent1_triage: triage,
    agent2_care_plan: null,
    care_plan_structured: carePlan,
  };
}

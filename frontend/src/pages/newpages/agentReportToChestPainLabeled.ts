import type { AgentReport } from "@/api/client";
import type { ChestPainLabeledReport } from "@/types/chestPainLabeled";

function safeStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function safeNum(v: unknown): number | undefined {
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function safeArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function agentReportToChestPainLabeled(report: AgentReport): ChestPainLabeledReport {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const triage: any = report.agent1_triage ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const carePlan: any = report.care_plan_structured ?? report.agent2_care_plan ?? {};

  // ── Case summary ──────────────────────────────────────────────
  const severityScore = safeNum(triage.severity_score) ?? 3;
  const acuityFromSeverity =
    severityScore <= 2 ? "Low" : severityScore <= 4 ? "Medium" : "High";
  const caseSummary: ChestPainLabeledReport["case_summary"] = {
    paragraph_summary: safeStr(report.paragraph_summary),
    encounter_type: safeStr(triage.encounter_type ?? triage.setting),
    acuity_level: safeStr(triage.acuity_level ?? triage.acuity) ?? acuityFromSeverity,
    time_since_onset_hours: safeNum(triage.time_since_onset_hours ?? triage.onset_hours),
    red_flag_present: Boolean(triage.red_flag_present ?? triage.is_red_flag ?? triage.red_flags?.length),
  };

  // ── Vitals & NEWS2 ───────────────────────────────────────────
  const rawVitals = triage.vitals ?? triage.vitals_parsed ?? {};
  const rawNews2 = triage.news2 ?? triage.NEWS2 ?? {};

  const vitals: ChestPainLabeledReport["vitals_risk"] = {
    vitals: {
      heart_rate: safeNum(rawVitals.heart_rate ?? rawVitals.hr),
      respiratory_rate: safeNum(rawVitals.respiratory_rate ?? rawVitals.rr),
      blood_pressure_systolic: safeNum(rawVitals.blood_pressure_systolic ?? rawVitals.bp_systolic ?? rawVitals.sbp),
      blood_pressure_diastolic: safeNum(rawVitals.blood_pressure_diastolic ?? rawVitals.bp_diastolic ?? rawVitals.dbp),
      oxygen_sat: safeNum(rawVitals.oxygen_sat ?? rawVitals.spo2 ?? rawVitals.o2_sat),
      temperature: safeNum(rawVitals.temperature ?? rawVitals.temp),
      consciousness: safeStr(rawVitals.consciousness ?? rawVitals.avpu),
      on_oxygen: Boolean(rawVitals.on_oxygen),
    },
    news2: {
      total_score: safeNum(rawNews2.total_score ?? rawNews2.score),
      risk_level: safeStr(rawNews2.risk_level ?? rawNews2.clinical_risk),
      urgency: safeStr(rawNews2.urgency),
      action_required: safeStr(rawNews2.action_required ?? rawNews2.recommendation),
      component_scores: rawNews2.component_scores ?? {},
    },
  };

  // ── Triage ───────────────────────────────────────────────────
  const riskFactorsRaw = triage.risk_factors;
  const riskFactorsArr = Array.isArray(riskFactorsRaw)
    ? riskFactorsRaw.map((r: unknown) => (typeof r === "string" ? r : String(r)))
    : [];
  const symptoms: ChestPainLabeledReport["triage"] = {
    chief_complaint: safeStr(triage.chief_complaint ?? triage.presenting_complaint) ?? safeStr(triage.clinical_assessment)?.split(".")[0]?.trim(),
    clinical_assessment: safeStr(triage.clinical_assessment),
    thought_process: Array.isArray(triage.thought_process)
      ? (triage.thought_process as unknown[]).map((s) => (typeof s === "string" ? s : String(s)))
      : undefined,
    symptom_features: safeArr(triage.symptom_features ?? triage.symptoms),
    concerning_findings: safeArr(triage.concerning_findings ?? triage.red_flags),
    risk_factors: riskFactorsArr,
  };

  // ── Differentials ─────────────────────────────────────────────
  const rawDiffs = safeArr<Record<string, unknown>>(
    triage.differential_diagnoses ?? triage.differentials ?? carePlan.differentials
  );
  const differentials: ChestPainLabeledReport["differentials"] = {
    differentials: rawDiffs.map((d) => ({
      diagnosis: safeStr(d.diagnosis ?? d.name) ?? "Unknown",
      category: safeStr(d.category),
      reasoning: safeStr(d.reasoning ?? d.rationale),
      estimated_likelihood: safeStr(d.estimated_likelihood ?? d.likelihood),
      supporting_features: safeArr<string>(d.supporting_features ?? d.features),
    })),
  };

  // ── Workup ───────────────────────────────────────────────────
  const rawLabTests = safeArr<Record<string, unknown>>(carePlan.lab_tests);
  const rawInvestigations = rawLabTests.length
    ? rawLabTests
    : safeArr<Record<string, unknown>>(
        carePlan.investigations ?? triage.investigations ?? carePlan.workup
      );
  const rawCareSteps = safeArr<Record<string, unknown>>(
    carePlan.care_steps_ordered ?? carePlan.treatment_steps ?? carePlan.steps
  );
  const workup: ChestPainLabeledReport["workup"] = {
    investigations: rawInvestigations.map((inv) => ({
      type: safeStr(inv.type) ?? "Lab",
      name: safeStr(inv.name ?? inv.test) ?? "Investigation",
      purpose: safeStr(inv.purpose ?? inv.reason ?? inv.rationale),
      priority: safeStr(inv.priority) ?? "Routine",
      fasting_required: Boolean(inv.fasting_required),
    })),
    care_steps_ordered: rawCareSteps.map((s, i) => ({
      step_number: (s.step_number as number) ?? i + 1,
      action: safeStr(s.action ?? s.step) ?? "",
      trigger_condition: safeStr(s.trigger_condition ?? s.condition),
    })),
  };

  // ── Medications ───────────────────────────────────────────────
  const rawMeds = safeArr<Record<string, unknown>>(
    carePlan.medications ?? carePlan.recommended_medications ?? carePlan.drugs
  );
  const medications: ChestPainLabeledReport["medications"] = {
    medications: rawMeds.map((m) => {
      const name = safeStr(m.name ?? m.drug ?? m.name_dose);
      const dose = safeStr(m.dose ?? m.dosage ?? m.notes);
      return {
        name: name ?? "Medication",
        dose,
        route: safeStr(m.route),
        frequency: safeStr(m.frequency),
        indication: safeStr(m.indication),
        monitoring_points: safeArr<string>(m.monitoring_points ?? m.monitoring),
        side_effect_category: safeStr(m.side_effect_category ?? m.side_effects),
      };
    }),
  };

  // ── ICD codes ─────────────────────────────────────────────────
  const rawICD = safeArr<Record<string, unknown>>(
    carePlan.icd_codes ?? carePlan.icd10_codes ?? triage.icd_codes
  );
  const icdLabel = (c: Record<string, unknown>) => safeStr(c.label ?? c.description);
  const icd_codes: ChestPainLabeledReport["icd_codes"] = {
    icd_codes: rawICD.map((c) => ({
      code: (safeStr(c.code) ?? "").toUpperCase(),
      label: icdLabel(c),
      category: safeStr(c.category),
      justification_symptoms: safeArr<string>(c.justification_symptoms ?? c.symptoms),
    })),
  };

  // ── Lifestyle & follow-up ─────────────────────────────────────
  const rawFU = carePlan.follow_up ?? carePlan.followup ?? {};
  const nextVisitStr = safeStr(carePlan.next_visit);
  const rawLifestyle = safeArr<Record<string, unknown>>(
    carePlan.lifestyle_recommendations ?? carePlan.lifestyle
  );
  const rawCare = carePlan as Record<string, unknown>;
  const rawDict = rawCare.raw as Record<string, string> | undefined;
  const treatmentPlanStr = safeStr(
    carePlan.treatment_plan ?? rawDict?.["TREATMENT PLAN"] ?? rawCare["TREATMENT PLAN"]
  );
  const lifestyle_followup: ChestPainLabeledReport["lifestyle_followup"] = {
    treatment_plan: treatmentPlanStr,
    follow_up: {
      timeframe: safeStr((rawFU as Record<string, unknown>).timeframe ?? (rawFU as Record<string, unknown>).timing) ?? nextVisitStr,
      reason: safeStr((rawFU as Record<string, unknown>).reason),
    },
    lifestyle_recommendations: rawLifestyle.map((r) => ({
      type: safeStr(r.type ?? r.category),
      recommendation_text: safeStr(r.recommendation_text ?? r.recommendation ?? r.text) ?? "",
      target_condition: safeStr(r.target_condition),
    })),
  };

  return {
    case_summary: caseSummary,
    vitals_risk: vitals,
    triage: symptoms,
    differentials,
    workup,
    medications,
    icd_codes,
    lifestyle_followup,
  };
}

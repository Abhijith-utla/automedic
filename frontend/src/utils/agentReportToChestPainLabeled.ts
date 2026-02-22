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

/**
 * Map AgentReport (backend triage + care_plan_structured) into ChestPainLabeledReport
 * for the 5-tab chest-pain dashboard. Handles current model output shapes.
 */
export function agentReportToChestPainLabeled(report: AgentReport): ChestPainLabeledReport {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipeline = (report.pipeline_json ?? {}) as {
    triage?: Record<string, unknown>;
    vitals?: Record<string, unknown>;
    news2?: Record<string, unknown>;
    care_plan?: Record<string, unknown>;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const triage: any = report.agent1_triage ?? pipeline.triage ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const carePlanFromPipeline = pipeline.care_plan
    ? {
        treatment_steps: safeStr(pipeline.care_plan.treatment_plan) ? [safeStr(pipeline.care_plan.treatment_plan)] : [],
        medications: safeArr<Record<string, unknown>>(pipeline.care_plan.recommended_medications).map((m) => ({
          name_dose: [safeStr(m.name), safeStr(m.notes)].filter(Boolean).join(" ").trim(),
          indication: safeStr(m.indication) ?? "",
          monitor: "",
        })),
        lab_tests: safeArr<Record<string, unknown>>(pipeline.care_plan.lab_tests).map((l) => ({
          name: safeStr(l.test) ?? "",
          reason: safeStr(l.reason) ?? "",
          priority: "Routine",
          note: "",
        })),
        icd_codes: safeArr<Record<string, unknown>>(pipeline.care_plan.icd10_codes).map((c) => ({
          code: safeStr(c.code) ?? "",
          description: safeStr(c.description) ?? "",
        })),
        diet_lifestyle: { recommendations: [] },
        next_visit: safeStr(pipeline.care_plan.next_visit) ?? "",
      }
    : {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const carePlan: any = report.care_plan_structured ?? carePlanFromPipeline ?? report.agent2_care_plan ?? {};

  // ── Case summary ──────────────────────────────────────────────
  const caseSummary: ChestPainLabeledReport["case_summary"] = {
    paragraph_summary: safeStr(report.paragraph_summary),
    encounter_type: safeStr(triage.encounter_type ?? triage.setting),
    acuity_level: safeStr(triage.acuity_level ?? triage.acuity),
    time_since_onset_hours: safeNum(triage.time_since_onset_hours ?? triage.onset_hours),
    red_flag_present: Boolean(triage.red_flag_present ?? triage.is_red_flag ?? triage.red_flags?.length),
  };

  // ── Vitals & NEWS2 ───────────────────────────────────────────
  const rawVitals = triage.vitals ?? triage.vitals_parsed ?? pipeline.vitals ?? {};
  const rawNews2 = triage.news2 ?? triage.NEWS2 ?? pipeline.news2 ?? {};
  const bpParsed = parseBloodPressure(rawVitals.blood_pressure);

  const vitals: ChestPainLabeledReport["vitals_risk"] = {
    vitals: {
      heart_rate: safeNum(rawVitals.heart_rate ?? rawVitals.hr),
      respiratory_rate: safeNum(rawVitals.respiratory_rate ?? rawVitals.rr),
      blood_pressure_systolic: safeNum(rawVitals.blood_pressure_systolic ?? rawVitals.bp_systolic ?? rawVitals.sbp ?? bpParsed?.systolic),
      blood_pressure_diastolic: safeNum(rawVitals.blood_pressure_diastolic ?? rawVitals.bp_diastolic ?? rawVitals.dbp ?? bpParsed?.diastolic),
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
      component_scores: normalizeComponentScores(rawNews2.component_scores ?? rawNews2.breakdown ?? {}),
    },
  };

  // ── Triage ───────────────────────────────────────────────────
  const symptoms: ChestPainLabeledReport["triage"] = {
    chief_complaint: safeStr(triage.chief_complaint ?? triage.presenting_complaint ?? report.paragraph_summary?.split(".")[0]?.trim()),
    clinical_assessment: safeStr(triage.clinical_assessment),
    thought_process: safeArr<string>(triage.thought_process),
    symptom_features: safeArr(triage.symptom_features ?? triage.symptoms),
    concerning_findings: safeArr(triage.concerning_findings ?? triage.red_flags),
    risk_factors: safeArr(triage.risk_factors),
    supporting_features: safeArr(triage.supporting_features),
  };

  // ── Differentials ─────────────────────────────────────────────
  const rawDiffs = safeArr<Record<string, unknown>>(
    triage.differential_diagnoses ?? triage.differentials ?? carePlan.differentials
  );
  const differentials: ChestPainLabeledReport["differentials"] = {
    differentials: rawDiffs.map((d) => ({
      diagnosis: safeStr(d.diagnosis ?? d.name) ?? "Not provided by model",
      category: safeStr(d.category),
      reasoning: safeStr(d.reasoning ?? d.rationale),
      estimated_likelihood: safeStr(d.estimated_likelihood ?? d.likelihood),
      supporting_features: safeArr<string>(d.supporting_features ?? d.features),
    })),
  };

  // ── Workup (from care_plan_structured.treatment_steps, lab_tests) ─────────────
  const rawInvestigations = safeArr<Record<string, unknown>>(
    carePlan.investigations ?? triage.investigations ?? carePlan.workup
  );
  const labTests = carePlan.lab_tests ?? [];
  const treatmentSteps = carePlan.treatment_steps ?? [];
  const investigationsFromLabs = Array.isArray(labTests)
    ? (labTests as { name?: string; test?: string; reason?: string; priority?: string; type?: string; fasting_required?: boolean }[]).map((l) => ({
        type: safeStr(l.type) ?? ((l.name ?? l.test ?? "").toLowerCase().includes("ecg") ? "ECG" : (l.name ?? l.test ?? "").toLowerCase().includes("x-ray") || (l.name ?? l.test ?? "").toLowerCase().includes("xray") ? "Imaging" : "Lab"),
        name: safeStr(l.name ?? l.test) ?? "Not provided by model",
        purpose: safeStr(l.reason),
        priority: (safeStr(l.priority) === "Urgent" ? "Urgent" : "Routine") as string,
        fasting_required: Boolean(l.fasting_required),
      }))
    : [];
  const careStepsOrdered = safeArr<Record<string, unknown>>(carePlan.care_steps_ordered);
  const rawCareSteps =
    careStepsOrdered.length > 0
      ? careStepsOrdered
      : (Array.isArray(treatmentSteps) ? treatmentSteps : []).map((action: string, i: number) =>
          typeof action === "string" ? { step_number: i + 1, action, trigger_condition: "" } : { step_number: i + 1, action: "", trigger_condition: "" }
        );
  const workup: ChestPainLabeledReport["workup"] = {
    investigations:
      rawInvestigations.length > 0
        ? rawInvestigations.map((inv) => ({
            type: safeStr(inv.type),
            name: safeStr(inv.name ?? inv.test) ?? "Not provided by model",
            purpose: safeStr(inv.purpose ?? inv.rationale),
            priority: safeStr(inv.priority) ?? "Routine",
            fasting_required: Boolean(inv.fasting_required),
          }))
        : investigationsFromLabs,
    care_steps_ordered: rawCareSteps.map((s: Record<string, unknown> | { action: string }, i: number) => {
      const o = typeof s === "object" && s ? (s as Record<string, unknown>) : {};
      return {
        step_number: (o.step_number as number) ?? i + 1,
        action: typeof s === "string" ? s : (safeStr(o.action ?? o.step) ?? ""),
        trigger_condition: safeStr(o.trigger_condition ?? o.condition),
      };
    }),
  };

  // ── Medications (from care_plan_structured.medications: name_dose, indication, monitor) ─
  const rawMeds = safeArr<Record<string, unknown>>(carePlan.medications ?? carePlan.drugs);
  const medications: ChestPainLabeledReport["medications"] = {
    medications: rawMeds.map((m) => {
      const nameDose = safeStr(m.name_dose ?? m.name ?? m.drug) ?? "";
      const [name, dose] = parseNameDose(nameDose);
      return {
        name: name || "Not provided by model",
        dose: safeStr(m.dose ?? m.dosage) ?? dose,
        route: safeStr(m.route),
        frequency: safeStr(m.frequency),
        indication: safeStr(m.indication),
        monitoring_points: safeArr<string>(m.monitoring_points ?? m.monitoring).length
          ? safeArr(m.monitoring_points ?? m.monitoring)
          : (safeStr(m.monitor) ? [safeStr(m.monitor)!] : []),
        side_effect_category: safeStr(m.side_effect_category ?? m.side_effects),
      };
    }),
  };

  // ── ICD codes (from care_plan_structured.icd_codes: code, description) ─────
  const rawICD = safeArr<Record<string, unknown>>(
    carePlan.icd_codes ?? carePlan.icd10_codes ?? triage.icd_codes
  );
  const icd_codes: ChestPainLabeledReport["icd_codes"] = {
    icd_codes: rawICD.map((c) => ({
      code: safeStr(c.code) ?? "",
      label: safeStr(c.label ?? c.description),
      category: safeStr(c.category),
      justification_symptoms: safeArr<string>(c.justification_symptoms ?? c.symptoms),
    })),
  };

  // ── Lifestyle & follow-up ─────────────────────────────────────
  const rawFU = carePlan.follow_up ?? carePlan.followup ?? {};
  const rawLifestyle = safeArr<Record<string, unknown>>(
    carePlan.lifestyle_recommendations ?? carePlan.lifestyle
  );
  const dietRecs = (carePlan.diet_lifestyle as { recommendations?: string[] } | undefined)?.recommendations ?? [];
  const lifestyle_followup: ChestPainLabeledReport["lifestyle_followup"] = {
    treatment_plan: safeStr(carePlan.treatment_plan) ?? safeArr<string>(carePlan.treatment_steps).join("\n"),
    follow_up: {
      timeframe: safeStr((rawFU as Record<string, unknown>).timeframe ?? (rawFU as Record<string, unknown>).timing),
      reason: safeStr((rawFU as Record<string, unknown>).reason) ?? safeStr(carePlan.next_visit),
    },
    lifestyle_recommendations:
      rawLifestyle.length > 0
        ? rawLifestyle.map((r) => ({
            type: safeStr(r.type ?? r.category),
            recommendation_text: safeStr(r.recommendation_text ?? r.recommendation ?? r.text) ?? "",
            target_condition: safeStr(r.target_condition),
          }))
        : dietRecs.map((r) => ({ type: "Diet" as const, recommendation_text: r, target_condition: "General" })),
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

function normalizeComponentScores(
  breakdown: Record<string, { score?: number; description?: string; value?: unknown; label?: string }>
): Record<string, { score: number; label: string }> {
  const out: Record<string, { score: number; label: string }> = {};
  for (const [k, v] of Object.entries(breakdown)) {
    if (v && typeof v === "object") {
      const score = typeof (v as { score?: number }).score === "number" ? (v as { score: number }).score : 0;
      const rawValue = (v as { value?: unknown })?.value;
      const label =
        (v as { description?: string }).description ??
        (v as { label?: string }).label ??
        (rawValue != null ? String(rawValue) : "—");
      out[k] = { score, label };
    }
  }
  return out;
}

function parseNameDose(nameDose: string): [string, string] {
  const match = nameDose.match(/^(.+?)\s+(\d[\d./\s]*(?:mg|mcg|g|ml|IU|units?)?)\s*$/i);
  if (match) return [match[1].trim(), match[2].trim()];
  return [nameDose.trim(), ""];
}

/** Parse pipeline vitals blood_pressure string "systolic/diastolic" (e.g. "145/92") for dashboard. */
function parseBloodPressure(
  bp: unknown
): { systolic: number; diastolic: number } | null {
  if (typeof bp !== "string" || !bp) return null;
  const parts = bp.split("/").map((s) => parseInt(s.trim(), 10));
  if (parts.length !== 2 || parts.some((n) => isNaN(n))) return null;
  return { systolic: parts[0], diastolic: parts[1] };
}

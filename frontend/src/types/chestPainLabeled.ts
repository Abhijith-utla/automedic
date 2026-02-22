/**
 * Labeled data model for chest-pain clinical insights (5-tab dashboard).
 * Optional sections so transformer can fill from AgentReport / care_plan_structured.
 */
export interface ChestPainLabeledReport {
  case_summary?: {
    case_id?: string;
    paragraph_summary?: string;
    encounter_type?: string;
    acuity_level?: string;
    time_since_onset_hours?: number;
    red_flag_present?: boolean;
  };

  vitals_risk?: {
    vitals?: {
      heart_rate?: number;
      respiratory_rate?: number;
      blood_pressure_systolic?: number;
      blood_pressure_diastolic?: number;
      oxygen_sat?: number;
      temperature?: number;
      consciousness?: string;
      on_oxygen?: boolean;
    };
    news2?: {
      total_score?: number;
      risk_level?: string;
      urgency?: string;
      action_required?: string;
      component_scores?: Record<string, { score: number; label: string }>;
    };
  };

  triage?: {
    chief_complaint?: string;
    clinical_assessment?: string;
    thought_process?: string[];
    symptom_features?: Array<{
      name: string;
      duration_hours?: number;
      severity?: string;
      modifiers?: string[];
    }>;
    concerning_findings?: string[];
    risk_factors?: string[];
    supporting_features?: string[];
  };

  differentials?: {
    differentials?: Array<{
      diagnosis: string;
      category?: string;
      reasoning?: string;
      estimated_likelihood?: string;
      supporting_features?: string[];
    }>;
  };

  workup?: {
    investigations?: Array<{
      type?: string;
      name: string;
      purpose?: string;
      priority?: string;
      fasting_required?: boolean;
    }>;
    care_steps_ordered?: Array<{
      step_number?: number;
      action: string;
      trigger_condition?: string;
    }>;
  };

  medications?: {
    medications?: Array<{
      name: string;
      dose?: string;
      route?: string;
      frequency?: string;
      indication?: string;
      monitoring_points?: string[];
      side_effect_category?: string;
    }>;
  };

  icd_codes?: {
    icd_codes?: Array<{
      code: string;
      label?: string;
      category?: string;
      justification_symptoms?: string[];
    }>;
  };

  lifestyle_followup?: {
    treatment_plan?: string;
    follow_up?: {
      timeframe?: string;
      reason?: string;
    };
    lifestyle_recommendations?: Array<{
      type?: string;
      recommendation_text: string;
      target_condition?: string;
    }>;
  };
}

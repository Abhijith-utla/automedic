/**
 * Clinical Plan: suggested treatments, labs/imaging orders, patient-friendly summary.
 */

import type { ClinicalPlanItem, PatientFriendlySummary } from "@/api/client";

interface ClinicalPlanPanelProps {
  plan: ClinicalPlanItem[];
  patientSummary?: PatientFriendlySummary | null;
  patientSummaryLang?: string;
  onOrder?: (item: ClinicalPlanItem) => void;
}

const PATIENT_SUMMARY_I18N: Record<string, { headline: string; summary: string; steps: string[] }> = {
  en: {
    headline: "Heart Attack (Acute Myocardial Infarction)",
    summary:
      "Your symptoms suggest possible reduced blood flow to the heart. We are running tests and may start medicines to protect your heart.",
    steps: [
      "Rest and avoid exertion until your doctor says otherwise.",
      "Take medications exactly as prescribed.",
      "Return to the ER if you have new or worse chest pain, shortness of breath, or fainting.",
    ],
  },
  es: {
    headline: "Ataque al corazón (Infarto de miocardio)",
    summary:
      "Sus síntomas sugieren posible reducción del flujo sanguíneo al corazón. Estamos realizando pruebas y podemos iniciar medicamentos para proteger su corazón.",
    steps: [
      "Descanse y evite esfuerzos hasta que su médico lo indique.",
      "Tome los medicamentos exactamente como se le indique.",
      "Vuelva a urgencias si tiene dolor de pecho nuevo o mayor, falta de aire o desmayo.",
    ],
  },
};

export function ClinicalPlanPanel({
  plan,
  patientSummary,
  patientSummaryLang = "en",
  onOrder,
}: ClinicalPlanPanelProps) {
  const i18n = PATIENT_SUMMARY_I18N[patientSummaryLang] ?? PATIENT_SUMMARY_I18N.en;
  const headline = patientSummary?.headline ?? i18n.headline;
  const summary = patientSummary?.summary ?? i18n.summary;
  const steps = patientSummary?.steps ?? i18n.steps;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-gray-900">Clinical plan</h3>
      <div>
        <div className="text-xs font-medium text-clinical-muted mb-2">
          Suggested treatments
        </div>
        <ul className="space-y-2">
          {plan.map((item, i) => (
            <li
              key={item.name + i}
              className="flex items-center justify-between gap-2 rounded border border-clinical-border bg-clinical-surface px-3 py-2 text-sm"
            >
              <span className="font-medium">{item.name}</span>
              {(item.dosage || item.frequency) && (
                <span className="text-clinical-muted">
                  {[item.dosage, item.frequency].filter(Boolean).join(" · ")}
                </span>
              )}
              {(item.type === "lab" || item.type === "imaging") && (
                <button
                  type="button"
                  onClick={() => onOrder?.(item)}
                  className="text-xs font-medium text-clinical-primary hover:underline"
                >
                  Order
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="text-xs font-medium text-clinical-muted mb-2">
          Patient-friendly summary
        </div>
        <div className="rounded-lg border border-clinical-border bg-amber-50/50 p-4 text-sm">
          <p className="font-medium text-gray-900">{headline}</p>
          <p className="mt-2 text-gray-700">{summary}</p>
          <ul className="mt-3 list-disc list-inside space-y-1 text-gray-700">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

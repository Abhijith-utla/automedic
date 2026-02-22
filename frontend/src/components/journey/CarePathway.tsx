import type { CarePlanStructured } from "@/api/client";

interface CarePathwayProps {
  carePlan: CarePlanStructured | null;
}

export function CarePathway({ carePlan }: CarePathwayProps) {
  const steps = carePlan?.treatment_steps ?? [];
  const meds = carePlan?.medications ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-clinical-border bg-clinical-surface p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Treatment plan</h3>
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="shrink-0 w-6 h-6 rounded-full bg-clinical-primary/15 text-clinical-primary flex items-center justify-center text-xs font-medium">
                {i + 1}
              </span>
              <span className="text-gray-700">{step}</span>
            </li>
          ))}
        </ol>
        {steps.length === 0 && (
          <p className="text-sm text-clinical-muted">No treatment steps in report.</p>
        )}
      </div>

      <div className="rounded-xl border border-clinical-border bg-clinical-surface p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Recommended medications</h3>
        <div className="space-y-3">
          {meds.map((m, i) => (
            <div key={i} className="rounded-lg border border-clinical-border bg-gray-50/50 p-3 text-sm">
              <div className="font-medium text-gray-900">{m.name_dose}</div>
              {m.indication && <div className="text-clinical-muted mt-1">Indication: {m.indication}</div>}
              {m.monitor && <div className="text-clinical-muted mt-0.5">Monitor: {m.monitor}</div>}
            </div>
          ))}
        </div>
        {meds.length === 0 && (
          <p className="text-sm text-clinical-muted">No medications in report.</p>
        )}
      </div>
    </div>
  );
}

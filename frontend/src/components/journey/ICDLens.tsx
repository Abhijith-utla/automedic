import type { CarePlanStructured } from "@/api/client";

interface ICDLensProps {
  carePlan: CarePlanStructured | null;
}

export function ICDLens({ carePlan }: ICDLensProps) {
  const codes = carePlan?.icd_codes ?? [];

  if (codes.length === 0) {
    return (
      <div className="rounded-xl border border-clinical-border bg-clinical-surface p-6 text-center text-clinical-muted text-sm">
        No ICD-10 codes in report.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-clinical-border bg-clinical-surface p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">ICD-10 codes</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {codes.map((c, i) => (
          <div
            key={i}
            className="flex gap-3 rounded-lg border border-clinical-border bg-gray-50/50 p-3"
          >
            <span className="shrink-0 font-mono text-sm font-semibold text-clinical-primary">
              {c.code}
            </span>
            <span className="text-sm text-gray-700">{c.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

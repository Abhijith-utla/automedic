import type { CarePlanStructured } from "@/api/client";

interface LifestyleBoardProps {
  carePlan: CarePlanStructured | null;
}

export function LifestyleBoard({ carePlan }: LifestyleBoardProps) {
  const recs = carePlan?.diet_lifestyle?.recommendations ?? [];
  const nextVisit = carePlan?.next_visit ?? "";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-clinical-border bg-clinical-surface p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Diet & lifestyle</h3>
        <ul className="space-y-2">
          {recs.map((r, i) => (
            <li key={i} className="text-sm text-gray-700 flex gap-2">
              <span className="text-clinical-primary shrink-0">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
        {recs.length === 0 && (
          <p className="text-sm text-clinical-muted">No diet/lifestyle recommendations in report.</p>
        )}
      </div>
      {nextVisit && (
        <div className="rounded-xl border border-clinical-border bg-clinical-surface p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Next visit</h3>
          <p className="text-sm text-gray-700">{nextVisit}</p>
        </div>
      )}
    </div>
  );
}

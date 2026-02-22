import { useState } from "react";
import type { CarePlanStructured } from "@/api/client";

interface LabsExplorerProps {
  carePlan: CarePlanStructured | null;
}

export function LabsExplorer({ carePlan }: LabsExplorerProps) {
  const [selected, setSelected] = useState(0);
  const labs = carePlan?.lab_tests ?? [];
  const current = labs[selected] ?? null;

  if (labs.length === 0) {
    return (
      <div className="rounded-xl border border-clinical-border bg-clinical-surface p-6 text-center text-clinical-muted text-sm">
        No lab tests in care plan.
      </div>
    );
  }

  const priorityColor = (p: string) =>
    p === "Urgent" ? "bg-red-100 text-red-800" : p === "Elective" ? "bg-gray-100 text-gray-700" : "bg-amber-50 text-amber-800";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {labs.map((lab, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSelected(i)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              selected === i
                ? "bg-clinical-primary text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {lab.name.length > 30 ? lab.name.slice(0, 28) + "…" : lab.name}
          </button>
        ))}
      </div>
      {current && (
        <div className="rounded-xl border border-clinical-border bg-clinical-surface p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-gray-900">{current.name}</span>
            <span className={`rounded px-2 py-0.5 text-xs ${priorityColor(current.priority)}`}>
              {current.priority}
            </span>
          </div>
          {current.reason && <p className="text-sm text-gray-600 mb-1">{current.reason}</p>}
          {current.note && <p className="text-xs text-clinical-muted">{current.note}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * Diagnostic Summary: chief complaint, AI suggestions (confidence + tooltip), ICD-10 selector.
 */

import { useState } from "react";
import { ConfidenceGauge } from "./ConfidenceGauge";
import { EditableField } from "./EditableField";
import type { DiagnosisSuggestion } from "@/api/client";

interface DiagnosticSummaryPanelProps {
  chiefComplaint: string;
  suggestions: DiagnosisSuggestion[];
  onChiefComplaintChange?: (v: string) => void;
  onSelectIcd10?: (code: string, title: string) => void;
}

const ICD10_OPTIONS = [
  { code: "I21.9", title: "Acute myocardial infarction, unspecified" },
  { code: "I20.0", title: "Unstable angina" },
  { code: "F41.1", title: "Generalized anxiety disorder" },
];

export function DiagnosticSummaryPanel({
  chiefComplaint,
  suggestions,
  onChiefComplaintChange,
  onSelectIcd10,
}: DiagnosticSummaryPanelProps) {
  const [complaint, setComplaint] = useState(chiefComplaint);
  const [selectedCode, setSelectedCode] = useState("");

  const handleComplaintSave = (v: string) => {
    setComplaint(v);
    onChiefComplaintChange?.(v);
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-gray-900">Diagnostic summary</h3>
      <EditableField
        label="Chief complaint"
        value={complaint}
        onSave={handleComplaintSave}
      />
      <div>
        <div className="text-xs font-medium text-clinical-muted mb-2">
          AI-suggested diagnoses
        </div>
        <ul className="space-y-3">
          {suggestions.map((s, i) => (
            <li
              key={s.icd10_code + i}
              className="rounded-lg border border-clinical-border bg-clinical-surface p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-gray-900">{s.condition}</span>
                <span
                  className="shrink-0 text-xs text-clinical-muted cursor-help border-b border-dotted border-clinical-muted"
                  title={s.source_snippet ? `Why: "${s.source_snippet}"` : "No snippet"}
                >
                  Why?
                </span>
              </div>
              <div className="mt-2">
                <ConfidenceGauge value={s.confidence} showPercent />
              </div>
              {s.source_snippet && (
                <p className="mt-1 text-xs text-clinical-muted" title="From transcript">
                  “{s.source_snippet}”
                </p>
              )}
              <p className="mt-1 text-xs text-clinical-muted">
                {s.icd10_code} — {s.icd10_title ?? ""}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <label className="text-xs font-medium text-clinical-muted block mb-2">
          ICD-10 code
        </label>
        <select
          value={selectedCode}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedCode(v);
            const opt = ICD10_OPTIONS.find((o) => o.code === v);
            if (opt) onSelectIcd10?.(opt.code, opt.title);
          }}
          className="w-full rounded border border-clinical-border px-3 py-2 text-sm bg-white"
        >
          <option value="">Select code</option>
          {ICD10_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.code} — {o.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

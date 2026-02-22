import { Fragment, useState } from "react";
import type { ChestPainLabeledReport } from "@/types/chestPainLabeled";

const RISK_COLORS: Record<string, { cell: string; text: string; border: string }> = {
  high: { cell: "bg-red-100 border-red-200", text: "text-red-700", border: "border-red-300" },
  medium: { cell: "bg-amber-50 border-amber-200", text: "text-amber-700", border: "border-amber-300" },
  low: { cell: "bg-slate-50 border-slate-100", text: "text-slate-400", border: "border-slate-200" },
  none: { cell: "bg-white border-slate-100", text: "text-slate-300", border: "border-slate-100" },
};

const SIDE_EFFECT_CHIP: Record<string, string> = {
  bleeding: "bg-red-50 text-red-700 border-red-200",
  hypotension: "bg-slate-100 text-slate-700 border-slate-300",
  bradycardia: "bg-slate-100 text-slate-700 border-slate-300",
  nausea: "bg-slate-100 text-slate-700 border-slate-300",
  default: "bg-slate-50 text-slate-600 border-slate-200",
};

const ICD_CATEGORY_STYLE: Record<string, { badge: string; bar: string }> = {
  Symptom: { badge: "bg-slate-100 text-slate-700 border-slate-300", bar: "bg-slate-500" },
  Psych: { badge: "bg-slate-100 text-slate-700 border-slate-300", bar: "bg-slate-500" },
  Musculoskeletal: { badge: "bg-slate-100 text-slate-700 border-slate-300", bar: "bg-slate-500" },
  Cardiac: { badge: "bg-red-50 text-red-700 border-red-200", bar: "bg-red-400" },
  default: { badge: "bg-slate-50 text-slate-600 border-slate-200", bar: "bg-slate-400" },
};

const RISK_TYPES = ["Bleeding", "Bradycardia", "Hypotension"];

function getMedRisk(med: { side_effect_category?: string }, riskType: string): string {
  const category = med.side_effect_category?.toLowerCase() ?? "";
  const type = riskType.toLowerCase();
  if (category === type) return "high";
  if (
    (category === "bleeding" && type === "hypotension") ||
    (category === "bradycardia" && type === "bleeding")
  ) return "low";
  return "none";
}

export function MedicationsICDTab({ data }: { data: ChestPainLabeledReport }) {
  const [hoveredICD, setHoveredICD] = useState<string | null>(null);
  const [expandedMed, setExpandedMed] = useState<string | null>(null);

  const medications = data.medications?.medications ?? [];
  const icdCodes = data.icd_codes?.icd_codes ?? [];

  const symptoms = data.triage?.symptom_features?.map((s) => s.name) ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Medications</p>
        </div>
        {medications.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-400">No medications listed</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Drug</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dose</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Route</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Frequency</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Side-effect risk</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Key monitoring</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {medications.map((med) => {
                  const sideChip = SIDE_EFFECT_CHIP[med.side_effect_category?.toLowerCase() ?? ""] ?? SIDE_EFFECT_CHIP.default;
                  const expanded = expandedMed === med.name;
                  return (
                    <Fragment key={med.name}>
                      <tr
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => setExpandedMed(expanded ? null : med.name)}
                      >
                        <td className="px-4 py-3 font-semibold text-slate-800">{med.name}</td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-xs">{med.dose}</td>
                        <td className="px-4 py-3 text-slate-500">{med.route}</td>
                        <td className="px-4 py-3 text-slate-500">{med.frequency}</td>
                        <td className="px-4 py-3">
                          {med.side_effect_category && (
                            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize ${sideChip}`}>
                              {med.side_effect_category} risk
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate">
                          {med.monitoring_points?.[0]}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-slate-50">
                          <td colSpan={6} className="px-6 py-3">
                            <div className="flex flex-wrap gap-3">
                              {med.indication && (
                                <div>
                                  <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Indication</p>
                                  <p className="text-xs text-slate-700">{med.indication}</p>
                                </div>
                              )}
                              {med.monitoring_points && med.monitoring_points.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Monitoring</p>
                                  <div className="flex flex-wrap gap-1">
                                    {med.monitoring_points.map((pt: string, i: number) => (
                                      <span key={i} className="rounded bg-white border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                                        {pt}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {medications.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Side-Effect Risk Matrix</p>
          <div className="overflow-x-auto">
            <table className="text-sm w-full max-w-xl">
              <thead>
                <tr>
                  <th className="text-left pr-4 pb-2 text-xs text-slate-400 font-medium">Drug</th>
                  {RISK_TYPES.map((rt) => (
                    <th key={rt} className="px-3 pb-2 text-center text-xs font-semibold text-slate-500">{rt}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {medications.map((med) => (
                  <tr key={med.name}>
                    <td className="pr-4 py-2 text-xs font-medium text-slate-700 whitespace-nowrap">{med.name}</td>
                    {RISK_TYPES.map((rt) => {
                      const level = getMedRisk(med, rt);
                      const style = RISK_COLORS[level] ?? RISK_COLORS.none;
                      return (
                        <td key={rt} className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center justify-center rounded-lg border w-16 h-8 text-[10px] font-bold ${style.cell} ${style.text}`}>
                            {level === "high" ? "HIGH" : level === "medium" ? "MED" : level === "low" ? "LOW" : "—"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 mt-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="h-2 w-5 rounded bg-red-100 border border-red-200" /> High</span>
            <span className="flex items-center gap-1"><span className="h-2 w-5 rounded bg-slate-100 border border-slate-300" /> Medium</span>
            <span className="flex items-center gap-1"><span className="h-2 w-5 rounded bg-slate-50 border border-slate-100" /> Low/None</span>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">ICD-10 Codes</p>
        {icdCodes.length === 0 ? (
          <p className="text-sm text-slate-400">No ICD codes listed.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {icdCodes.map((code) => {
              const cat = code.category ?? "default";
              const style = ICD_CATEGORY_STYLE[cat] ?? ICD_CATEGORY_STYLE.default;
              const relevance = code.justification_symptoms?.length
                ? Math.min((code.justification_symptoms.length / 3) * 100, 100)
                : 60;
              return (
                <div
                  key={code.code}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-all cursor-default"
                  onMouseEnter={() => setHoveredICD(code.code)}
                  onMouseLeave={() => setHoveredICD(null)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-slate-800 text-sm">{code.code}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}>{cat}</span>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">{code.label}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 shrink-0">Relevance</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${style.bar}`}
                        style={{ width: `${relevance}%` }}
                      />
                    </div>
                  </div>
                  {code.justification_symptoms && code.justification_symptoms.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {code.justification_symptoms.map((sym: string, i: number) => (
                        <span key={i} className="rounded bg-slate-50 border border-slate-200 px-1.5 py-0.5 text-[9px] text-slate-500">
                          {sym}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {icdCodes.length > 0 && symptoms.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm overflow-x-auto">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">ICD–Symptom Mapping</p>
          <div className="flex gap-8 items-start min-w-[480px]">
            <div className="flex flex-col gap-3 shrink-0">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Symptoms</p>
              {symptoms.map((sym, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 whitespace-nowrap"
                >
                  {sym}
                </div>
              ))}
            </div>

            <svg
              className="flex-1"
              style={{ minWidth: 80, height: `${Math.max(symptoms.length, icdCodes.length) * 44}px` }}
            >
              {icdCodes.map((code, ci) =>
                (code.justification_symptoms ?? []).map((sym: string, si: number) => {
                  const symIndex = symptoms.indexOf(sym);
                  if (symIndex < 0) return null;
                  const y1 = symIndex * 44 + 20;
                  const y2 = ci * 44 + 20;
                  const isHovered = hoveredICD === code.code;
                  return (
                    <line
                      key={`${ci}-${si}`}
                      x1="0"
                      y1={y1}
                      x2="100%"
                      y2={y2}
                      stroke={isHovered ? "#991b1b" : "#cbd5e1"}
                      strokeWidth={isHovered ? 2 : 1}
                      strokeDasharray={isHovered ? undefined : "4 2"}
                      style={{ transition: "stroke 0.2s, stroke-width 0.2s" }}
                    />
                  );
                })
              )}
            </svg>

            <div className="flex flex-col gap-3 shrink-0">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">ICD Codes</p>
              {icdCodes.map((code) => {
                const cat = code.category ?? "default";
                const style = ICD_CATEGORY_STYLE[cat] ?? ICD_CATEGORY_STYLE.default;
                return (
                  <div
                    key={code.code}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium whitespace-nowrap cursor-default transition-all ${
                      hoveredICD === code.code ? "shadow-md scale-105" : ""
                    } ${style.badge}`}
                    onMouseEnter={() => setHoveredICD(code.code)}
                    onMouseLeave={() => setHoveredICD(null)}
                  >
                    <span className="font-mono font-bold">{code.code}</span>
                    <span className="ml-1.5 opacity-70">{code.label?.slice(0, 24)}{(code.label?.length ?? 0) > 24 ? "…" : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

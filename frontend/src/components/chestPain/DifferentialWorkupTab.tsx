import { useState } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ChestPainLabeledReport } from "@/types/chestPainLabeled";

const CATEGORY_STYLE: Record<string, { border: string; bg: string; badge: string; dot: string }> = {
  Musculoskeletal: { border: "border-slate-300", bg: "bg-slate-50", badge: "bg-slate-100 text-slate-700", dot: "bg-slate-500" },
  Psychogenic: { border: "border-slate-300", bg: "bg-slate-50", badge: "bg-slate-100 text-slate-700", dot: "bg-slate-500" },
  Cardiac: { border: "border-red-200", bg: "bg-red-50", badge: "bg-red-100 text-red-700", dot: "bg-red-400" },
  Respiratory: { border: "border-slate-300", bg: "bg-slate-50", badge: "bg-slate-100 text-slate-700", dot: "bg-slate-500" },
  GI: { border: "border-slate-300", bg: "bg-slate-50", badge: "bg-slate-100 text-slate-700", dot: "bg-slate-500" },
  default: { border: "border-slate-200", bg: "bg-slate-50", badge: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
};

const LIKELIHOOD_PCT: Record<string, number> = {
  likely: 70,
  possible: 45,
  unlikely: 20,
};

const INVESTIGATION_TYPE_ICON: Record<string, string> = {
  ECG: "ECG",
  Imaging: "IMG",
  Lab: "LAB",
  Consult: "CONS",
};

const PRIORITY_STYLE: Record<string, string> = {
  Urgent: "bg-red-100 text-red-700 border-red-200",
  Routine: "bg-slate-100 text-slate-600 border-slate-200",
};

export function DifferentialWorkupTab({ data }: { data: ChestPainLabeledReport }) {
  const [expandedDiff, setExpandedDiff] = useState<string | null>(null);
  const [highlightedDiff, setHighlightedDiff] = useState<string | null>(null);

  const differentials = data.differentials?.differentials ?? [];
  const investigations = data.workup?.investigations ?? [];
  const careSteps = data.workup?.care_steps_ordered ?? [];

  const radarData = differentials.map((d) => ({
    diagnosis: d.diagnosis.length > 22 ? d.diagnosis.slice(0, 22) + "…" : d.diagnosis,
    fullName: d.diagnosis,
    likelihood: LIKELIHOOD_PCT[d.estimated_likelihood ?? "possible"] ?? 40,
    category: d.category,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Differential Diagnoses</p>
          {differentials.length === 0 && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-400">
              No differentials available
            </div>
          )}
          {differentials.map((d) => {
            const style = CATEGORY_STYLE[d.category ?? ""] ?? CATEGORY_STYLE.default;
            const expanded = expandedDiff === d.diagnosis;
            const highlighted = highlightedDiff === d.diagnosis;
            const pct = LIKELIHOOD_PCT[d.estimated_likelihood ?? "possible"] ?? 40;
            return (
              <div
                key={d.diagnosis}
                className={`rounded-2xl border-2 bg-white p-4 shadow-sm transition-all cursor-pointer ${style.border} ${highlighted ? "ring-2 ring-offset-1 ring-slate-300 shadow-md" : ""}`}
                onClick={() => setExpandedDiff(expanded ? null : d.diagnosis)}
                onMouseEnter={() => setHighlightedDiff(d.diagnosis)}
                onMouseLeave={() => setHighlightedDiff(null)}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${style.dot}`} />
                    <h4 className="font-semibold text-slate-800 text-sm leading-tight">{d.diagnosis}</h4>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold border shrink-0 ${style.badge}`}>
                    {d.category}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-slate-400 w-16 shrink-0">Likelihood</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${style.dot}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-600 w-14 text-right capitalize">{d.estimated_likelihood}</span>
                </div>

                {expanded && d.reasoning && (
                  <div className={`mt-3 rounded-xl ${style.bg} border ${style.border} px-3 py-2.5 text-sm text-slate-700 leading-relaxed animate-fade-in`}>
                    {d.reasoning}
                  </div>
                )}

                {expanded && d.supporting_features && d.supporting_features.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {d.supporting_features.map((f: string, i: number) => (
                      <span key={i} className={`rounded-full px-2 py-0.5 text-[10px] border ${style.badge}`}>{f}</span>
                    ))}
                  </div>
                )}

                <p className="text-[10px] text-slate-400 mt-2">{expanded ? "Click to collapse" : "Click for reasoning"}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Likelihood Comparison</p>
          {radarData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis
                  dataKey="diagnosis"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <Radar
                  name="Likelihood"
                  dataKey="likelihood"
                  stroke="#991b1b"
                  fill="#991b1b"
                  fillOpacity={0.18}
                  strokeWidth={2}
                  dot={{ fill: "#991b1b", r: 4 }}
                />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.[0] ? (
                      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-xs">
                        <p className="font-semibold text-slate-800">{payload[0].payload.fullName}</p>
                        <p className="text-slate-500">Likelihood: <span className="font-bold text-red-700">{payload[0].value}%</span></p>
                      </div>
                    ) : null
                  }
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Planned Investigations</p>
        {investigations.length === 0 ? (
          <p className="text-sm text-slate-400">No investigations listed.</p>
        ) : (
          <div className="flex flex-col gap-0">
            {investigations.map((inv, i) => (
              <div key={i} className="flex items-start gap-4 py-4 border-b border-slate-100 last:border-0">
                <div className="flex flex-col items-center">
                  <div className={`h-10 w-10 rounded-xl border border-slate-300 flex items-center justify-center text-[10px] font-bold ${i === 0 ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>
                    {INVESTIGATION_TYPE_ICON[inv.type ?? ""] ?? "ITEM"}
                  </div>
                  {i < investigations.length - 1 && (
                    <div className="w-0.5 h-4 bg-slate-200 mt-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm">{inv.name}</span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLE[inv.priority ?? "Routine"] ?? PRIORITY_STYLE.Routine}`}>
                      {inv.priority}
                    </span>
                    {inv.fasting_required && (
                      <span className="rounded-full bg-orange-50 border border-orange-200 px-2.5 py-0.5 text-[10px] font-medium text-orange-700">
                        Fasting required
                      </span>
                    )}
                  </div>
                  {inv.purpose && <p className="text-xs text-slate-500 mt-0.5">{inv.purpose}</p>}
                </div>
                <span className="text-xs text-slate-400 shrink-0">{inv.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {careSteps.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Action Logic</p>
          <div className="flex flex-col gap-2">
            {careSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {step.step_number ?? i + 1}
                </div>
                <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
                  <p className="text-sm font-medium text-slate-800">{step.action}</p>
                  {step.trigger_condition && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      If: <span className="italic">{step.trigger_condition}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

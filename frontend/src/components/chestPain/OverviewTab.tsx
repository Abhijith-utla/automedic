import { useState } from "react";
import type { ChestPainLabeledReport } from "@/types/chestPainLabeled";

const SYMPTOM_CHIP_COLOR: Record<string, string> = {
  moderate: "bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200",
  mild: "bg-white border-slate-300 text-slate-700 hover:bg-slate-100",
  severe: "bg-red-50 border-red-300 text-red-800 hover:bg-red-100",
};

const ACUITY_COLOR: Record<string, { bar: string; badge: string; text: string }> = {
  Low: { bar: "bg-slate-500", badge: "bg-slate-100 text-slate-700 border-slate-300", text: "text-slate-700" },
  Medium: { bar: "bg-slate-700", badge: "bg-slate-100 text-slate-800 border-slate-300", text: "text-slate-800" },
  High: { bar: "bg-red-500", badge: "bg-red-50 text-red-700 border-red-200", text: "text-red-700" },
};

const TIMELINE_STEPS = [
  { icon: "1", label: "Onset", sub: "Chief complaint", color: "bg-white text-slate-700 border-slate-300" },
  { icon: "2", label: "Triage", sub: "Arrival & assessment", color: "bg-white text-slate-700 border-slate-300" },
  { icon: "3", label: "Vitals", sub: "Recorded & reviewed", color: "bg-white text-slate-700 border-slate-300" },
  { icon: "4", label: "Workup", sub: "Planned investigations", color: "bg-white text-slate-700 border-slate-300" },
];

export function OverviewTab({ data }: { data: ChestPainLabeledReport }) {
  const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);
  const summary = data.case_summary;
  const triage = data.triage;
  const acuity = summary?.acuity_level ?? "Low";
  const acuityStyle = ACUITY_COLOR[acuity] ?? ACUITY_COLOR.Low;
  const news2Score = data.vitals_risk?.news2?.total_score ?? 0;
  const news2Risk = data.vitals_risk?.news2?.risk_level ?? "Low";
  const barPct = Math.min((news2Score / 20) * 100, 100);

  const selectedSymptomData = triage?.symptom_features?.find(
    (s) => s.name === selectedSymptom
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Patient story card */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Chief Complaint</p>
              <h3 className="text-xl font-bold text-slate-800 leading-snug">
                {triage?.chief_complaint ?? "Not provided by model"}
              </h3>
            </div>
            <div className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${acuityStyle.badge}`}>
              <span className={`h-2 w-2 rounded-full ${acuityStyle.bar}`} />
              {acuity} Acuity
            </div>
          </div>

          {/* Meta pills */}
          <div className="flex flex-wrap gap-2 mb-5">
            {summary?.encounter_type && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {summary.encounter_type}
              </span>
            )}
            {summary?.time_since_onset_hours != null && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {summary.time_since_onset_hours}h since onset
              </span>
            )}
            {summary?.red_flag_present && (
              <span className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-semibold text-red-700">
                Red flag present
              </span>
            )}
          </div>

          {/* Acuity severity bar */}
          <div className="mb-1.5 flex justify-between text-xs text-slate-500 font-medium">
            <span>NEWS2 Severity Score</span>
            <span className={acuityStyle.text}>{news2Score} / 20 — {news2Risk}</span>
          </div>
          <div className="h-3 rounded-full bg-gradient-to-r from-slate-200 via-slate-300 to-red-100 overflow-hidden border border-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-700 ${acuityStyle.bar}`}
              style={{ width: `${Math.max(barPct, 3)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>Low (0–4)</span><span>Medium (5–6)</span><span>High (7+)</span>
          </div>

          {/* Summary paragraph */}
          {summary?.paragraph_summary && (
            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
              <p className="text-sm text-slate-600 leading-relaxed">{summary.paragraph_summary}</p>
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="space-y-3">
          <QuickStat icon="N" label="NEWS2 Score" value={String(news2Score)} sub={news2Risk + " risk"} color="red" />
          <QuickStat
            icon="R"
            label="Risk Factors"
            value={String(triage?.risk_factors?.length ?? 0)}
            sub="identified"
            color="slate"
          />
          <QuickStat
            icon="D"
            label="Differentials"
            value={String(data.differentials?.differentials?.length ?? 0)}
            sub="under consideration"
            color="slate"
          />
          {triage?.risk_factors && triage.risk_factors.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Risk Factors</p>
              <div className="flex flex-wrap gap-1.5">
                {triage.risk_factors.map((rf, i) => (
                  <span key={i} className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs text-amber-800">
                    {rf}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Symptom chips */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Symptom Features</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {triage?.symptom_features?.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setSelectedSymptom(selectedSymptom === s.name ? null : s.name)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all cursor-pointer select-none
                ${selectedSymptom === s.name ? "ring-2 ring-offset-1 ring-slate-400 scale-105 shadow-md" : ""}
                ${SYMPTOM_CHIP_COLOR[s.severity ?? "mild"] ?? SYMPTOM_CHIP_COLOR.mild}`}
            >
              {s.name}
              {s.duration_hours != null && (
                <span className="ml-1.5 opacity-60 text-xs">{s.duration_hours}h</span>
              )}
            </button>
          ))}
        </div>

        {selectedSymptomData && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${SYMPTOM_CHIP_COLOR[selectedSymptomData.severity ?? "mild"]}`}>
                {selectedSymptomData.severity}
              </span>
              {selectedSymptomData.duration_hours != null && (
                <span className="text-xs text-slate-500">Duration: {selectedSymptomData.duration_hours}h</span>
              )}
            </div>
            {selectedSymptomData.modifiers && selectedSymptomData.modifiers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedSymptomData.modifiers.map((m, i) => (
                  <span key={i} className="rounded bg-white border border-slate-200 px-2 py-0.5 text-xs text-slate-600">
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {triage?.concerning_findings && triage.concerning_findings.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Concerning Findings</p>
            <div className="flex flex-wrap gap-2">
              {triage.concerning_findings.map((f, i) => (
                <span key={i} className="rounded-full bg-red-50 border border-red-200 text-red-700 px-3 py-1 text-xs font-medium">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Journey timeline */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">Encounter Journey</p>
        <div className="relative">
          <div className="absolute top-7 left-7 right-7 h-0.5 bg-gradient-to-r from-slate-200 via-slate-300 to-red-200" />
          <div className="grid grid-cols-4 gap-4 relative">
            {TIMELINE_STEPS.map((step, i) => (
              <div key={i} className="flex flex-col items-center group">
                <div className={`h-14 w-14 rounded-2xl border-2 flex items-center justify-center text-xl shadow-sm mb-2 transition-transform group-hover:scale-110 ${step.color}`}>
                  {step.icon}
                </div>
                <span className="text-xs font-semibold text-slate-700 text-center">{step.label}</span>
                <span className="text-[10px] text-slate-400 text-center mt-0.5">{step.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStat({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub: string; color: string }) {
  const colorMap: Record<string, string> = {
    slate: "bg-slate-50 border-slate-200",
    red: "bg-red-50 border-red-200",
  };
  const textMap: Record<string, string> = {
    slate: "text-slate-700",
    red: "text-red-700",
  };
  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-3 ${colorMap[color] ?? colorMap.slate}`}>
      <span className="text-xs font-bold h-8 w-8 rounded-full border border-slate-300 bg-white flex items-center justify-center text-slate-700">{icon}</span>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className={`text-xl font-bold ${textMap[color] ?? textMap.slate}`}>{value}</p>
        <p className="text-[10px] text-slate-400">{sub}</p>
      </div>
    </div>
  );
}

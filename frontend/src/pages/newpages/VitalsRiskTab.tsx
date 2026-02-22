import { useState } from "react";
import type { ChestPainLabeledReport } from "@/types/chestPainLabeled";

type VitalStatus = "normal" | "high-normal" | "abnormal" | "low";

function getVitalStatus(key: string, value: number): VitalStatus {
  const ranges: Record<string, { low: number; high: number; warnLow?: number; warnHigh?: number }> = {
    heart_rate: { low: 50, high: 100, warnLow: 60, warnHigh: 90 },
    respiratory_rate: { low: 12, high: 20 },
    blood_pressure_systolic: { low: 90, high: 140, warnHigh: 130 },
    blood_pressure_diastolic: { low: 60, high: 90, warnHigh: 80 },
    oxygen_sat: { low: 95, high: 100, warnLow: 97 },
    temperature: { low: 36.0, high: 37.5 },
  };
  const r = ranges[key];
  if (!r) return "normal";
  if (value < r.low || value > r.high) return "abnormal";
  if (r.warnHigh && value > r.warnHigh) return "high-normal";
  if (r.warnLow && value < r.warnLow) return "high-normal";
  return "normal";
}

const STATUS_STYLE: Record<VitalStatus, { border: string; badge: string; dot: string; label: string }> = {
  normal: {
    border: "border-emerald-200",
    badge: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    label: "Normal",
  },
  "high-normal": {
    border: "border-amber-300",
    badge: "bg-amber-50 text-amber-700",
    dot: "bg-amber-400",
    label: "High-normal",
  },
  abnormal: {
    border: "border-red-300",
    badge: "bg-red-50 text-red-700",
    dot: "bg-red-500",
    label: "Abnormal",
  },
  low: {
    border: "border-sky-200",
    badge: "bg-sky-50 text-sky-700",
    dot: "bg-sky-400",
    label: "Low",
  },
};

const NEWS2_PARAMS = [
  { key: "respiratory_rate", label: "Resp. Rate" },
  { key: "oxygen_sat", label: "SpO₂" },
  { key: "blood_pressure_systolic", label: "BP Systolic" },
  { key: "heart_rate", label: "Heart Rate" },
  { key: "temperature", label: "Temperature" },
  { key: "consciousness", label: "Consciousness" },
];

export function VitalsRiskTab({ data }: { data: ChestPainLabeledReport }) {
  const [hoveredParam, setHoveredParam] = useState<string | null>(null);
  const vitals = data.vitals_risk?.vitals;
  const news2 = data.vitals_risk?.news2;
  const compScores = news2?.component_scores ?? {};
  const totalScore = news2?.total_score ?? 0;
  const riskLevel = news2?.risk_level ?? "Low";
  const urgency = news2?.urgency ?? "Low";

  // Gauge needle position (0 to 100 where 0=Low, 100=High)
  const gaugeValue = Math.min((totalScore / 20) * 100, 100);

  const news2BarData = NEWS2_PARAMS.map((p) => {
    const cs = compScores[p.key] ?? { score: 0, label: p.label };
    return {
      param: p.label,
      score: cs.score ?? 0,
      label: cs.label ?? p.label,
    };
  });

  const vitalTiles = [
    {
      key: "heart_rate",
      label: "Heart Rate",
      value: vitals?.heart_rate != null ? `${vitals.heart_rate}` : "82",
      unit: "bpm",
      range: "60–100",
      icon: "💓",
    },
    {
      key: "respiratory_rate",
      label: "Respiratory Rate",
      value: vitals?.respiratory_rate != null ? `${vitals.respiratory_rate}` : "16",
      unit: "/min",
      range: "12–20",
      icon: "🫁",
    },
    {
      key: "blood_pressure_systolic",
      label: "Blood Pressure",
      value:
        vitals?.blood_pressure_systolic != null
          ? `${vitals.blood_pressure_systolic}/${vitals?.blood_pressure_diastolic ?? 88}`
          : "138/88",
      unit: "mmHg",
      range: "90–130/60–80",
      icon: "🩺",
    },
    {
      key: "oxygen_sat",
      label: "SpO₂",
      value: vitals?.oxygen_sat != null ? `${vitals.oxygen_sat}` : "98",
      unit: "%",
      range: "95–100",
      icon: "🫀",
    },
    {
      key: "temperature",
      label: "Temperature",
      value: vitals?.temperature != null ? `${vitals.temperature}` : "36.8",
      unit: "°C",
      range: "36.0–37.5",
      icon: "🌡️",
    },
    {
      key: "consciousness",
      label: "Consciousness",
      value: vitals?.consciousness ?? "Alert",
      unit: "",
      range: "AVPU",
      icon: "🧠",
      isText: true,
    },
  ];

  const riskColor = riskLevel === "High" ? "text-red-600" : riskLevel === "Medium" ? "text-amber-600" : "text-emerald-600";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Risk meter + NEWS2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Circular gauge */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col items-center">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">NEWS2 Risk Meter</p>
          <div className="relative w-48 h-32 mx-auto">
            {/* SVG arc gauge */}
            <svg viewBox="0 0 200 110" className="w-full h-full">
              {/* Background arcs */}
              <path d="M 20 100 A 80 80 0 0 1 80 25" stroke="#d1fae5" strokeWidth="16" fill="none" strokeLinecap="round" />
              <path d="M 80 25 A 80 80 0 0 1 120 25" stroke="#fef3c7" strokeWidth="16" fill="none" strokeLinecap="round" />
              <path d="M 120 25 A 80 80 0 0 1 180 100" stroke="#fee2e2" strokeWidth="16" fill="none" strokeLinecap="round" />
              {/* Active arc */}
              {gaugeValue <= 33 && (
                <path
                  d={`M 20 100 A 80 80 0 0 1 ${20 + 160 * (gaugeValue / 100)} ${100 - 80 * Math.sin(Math.PI * (gaugeValue / 100))}`}
                  stroke="#10b981" strokeWidth="16" fill="none" strokeLinecap="round"
                />
              )}
              {gaugeValue > 33 && gaugeValue <= 66 && (
                <>
                  <path d="M 20 100 A 80 80 0 0 1 80 25" stroke="#10b981" strokeWidth="16" fill="none" strokeLinecap="round" />
                  <path d="M 80 25 A 80 80 0 0 1 100 22" stroke="#f59e0b" strokeWidth="16" fill="none" strokeLinecap="round" />
                </>
              )}
              {gaugeValue > 66 && (
                <>
                  <path d="M 20 100 A 80 80 0 0 1 80 25" stroke="#10b981" strokeWidth="16" fill="none" strokeLinecap="round" />
                  <path d="M 80 25 A 80 80 0 0 1 120 25" stroke="#f59e0b" strokeWidth="16" fill="none" strokeLinecap="round" />
                  <path d="M 120 25 A 80 80 0 0 1 180 100" stroke="#ef4444" strokeWidth="16" fill="none" strokeLinecap="round" />
                </>
              )}
              {/* Center score */}
              <text x="100" y="90" textAnchor="middle" fontSize="28" fontWeight="700" fill="#1e293b">{totalScore}</text>
              <text x="100" y="108" textAnchor="middle" fontSize="10" fill="#94a3b8">out of 20</text>
            </svg>
          </div>
          <div className="text-center mt-2">
            <span className={`text-2xl font-bold ${riskColor}`}>{riskLevel}</span>
            <p className="text-xs text-slate-500 mt-0.5">Urgency: <strong>{urgency}</strong></p>
            {news2?.action_required && (
              <p className="text-xs text-slate-500 mt-1 max-w-[180px] mx-auto">{news2.action_required}</p>
            )}
          </div>
          <div className="flex gap-3 mt-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Low 0–4</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Med 5–6</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />High 7+</span>
          </div>
        </div>

        {/* NEWS2 breakdown bar */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">NEWS2 Parameter Breakdown</p>
          <div className="space-y-2.5">
            {news2BarData.map((row) => (
              <div
                key={row.param}
                className="flex items-center gap-3 group cursor-default"
                onMouseEnter={() => setHoveredParam(row.param)}
                onMouseLeave={() => setHoveredParam(null)}
              >
                <span className="w-28 text-xs text-slate-500 shrink-0 text-right">{row.param}</span>
                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full flex items-center px-2 text-[10px] font-medium text-white transition-all duration-500 ${
                      row.score === 0 ? "bg-emerald-400" : row.score <= 1 ? "bg-amber-400" : "bg-red-500"
                    }`}
                    style={{ width: `${Math.max(row.score === 0 ? 5 : (row.score / 3) * 100, 5)}%` }}
                  />
                </div>
                <span
                  className={`text-xs font-bold w-4 text-center ${
                    row.score === 0 ? "text-emerald-600" : row.score <= 1 ? "text-amber-600" : "text-red-600"
                  }`}
                >
                  {row.score}
                </span>
                {hoveredParam === row.param && (
                  <span className="text-[10px] text-slate-400 max-w-[120px] truncate">{row.label}</span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Total NEWS2 score</span>
            <span className={`text-lg font-bold ${riskColor}`}>{totalScore} — {riskLevel} risk</span>
          </div>
        </div>
      </div>

      {/* Vitals tiles */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Vital Signs</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {vitalTiles.map((v) => {
            const numVal = parseFloat(v.value);
            const status: VitalStatus = v.isText ? "normal" : getVitalStatus(v.key, numVal);
            const style = STATUS_STYLE[status];
            return (
              <div
                key={v.key}
                className={`rounded-2xl border-2 bg-white p-4 flex flex-col items-center shadow-sm transition-all hover:shadow-md ${style.border}`}
              >
                <span className="text-2xl mb-1">{v.icon}</span>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider text-center mb-1">{v.label}</p>
                <p className="text-lg font-bold text-slate-800 tabular-nums">
                  {v.value}
                  {v.unit && <span className="text-xs font-normal text-slate-400 ml-0.5">{v.unit}</span>}
                </p>
                <span className={`mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1 ${style.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                  {style.label}
                </span>
                <p className="text-[9px] text-slate-300 mt-1">Range: {v.range}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* On oxygen */}
      {vitals?.on_oxygen && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 flex items-center gap-2">
          <span className="text-sky-600 text-lg">💨</span>
          <span className="text-sm font-medium text-sky-800">Patient is on supplemental oxygen</span>
        </div>
      )}
    </div>
  );
}

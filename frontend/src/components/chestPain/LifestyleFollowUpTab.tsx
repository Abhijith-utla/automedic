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

const LIFESTYLE_STYLE: Record<string, { bg: string; border: string; icon: string; badge: string; text: string }> = {
  Diet: { bg: "bg-white", border: "border-slate-300", icon: "DIET", badge: "bg-slate-100 text-slate-700", text: "text-slate-800" },
  Exercise: { bg: "bg-white", border: "border-slate-300", icon: "EX", badge: "bg-slate-100 text-slate-700", text: "text-slate-800" },
  Sleep: { bg: "bg-white", border: "border-slate-300", icon: "SLP", badge: "bg-slate-100 text-slate-700", text: "text-slate-800" },
  Relaxation: { bg: "bg-white", border: "border-slate-300", icon: "REL", badge: "bg-slate-100 text-slate-700", text: "text-slate-800" },
  Substance: { bg: "bg-red-50", border: "border-red-200", icon: "SUB", badge: "bg-red-100 text-red-700", text: "text-red-800" },
  Substances: { bg: "bg-red-50", border: "border-red-200", icon: "SUB", badge: "bg-red-100 text-red-700", text: "text-red-800" },
  default: { bg: "bg-slate-50", border: "border-slate-200", icon: "GEN", badge: "bg-slate-100 text-slate-700", text: "text-slate-800" },
};

const RADAR_AXES = ["Diet", "Exercise", "Sleep", "Relaxation", "Substances"];

export function LifestyleFollowUpTab({ data }: { data: ChestPainLabeledReport }) {
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null);

  const followUp = data.lifestyle_followup?.follow_up;
  const recommendations = data.lifestyle_followup?.lifestyle_recommendations ?? [];

  const radarData = RADAR_AXES.map((axis) => {
    const recs = recommendations.filter(
      (r) => r.type === axis || r.type === axis.slice(0, -1)
    );
    return {
      axis,
      value: recs.length > 0 ? Math.min(recs.length * 35 + 30, 100) : 15,
    };
  });

  const grouped: Record<string, typeof recommendations> = {};
  for (const r of recommendations) {
    const type = r.type ?? "default";
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(r);
  }

  const activeRec = recommendations.find((r) => r.recommendation_text === activeDrawer);
  const activeStyle = activeRec ? (LIFESTYLE_STYLE[activeRec.type ?? ""] ?? LIFESTYLE_STYLE.default) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {followUp && (
        <div className="rounded-2xl border-2 border-red-200 bg-gradient-to-r from-white via-slate-50 to-red-50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white border border-red-200 flex items-center justify-center text-xs font-bold text-red-700 shadow-sm shrink-0">
              F/U
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Follow-up Required</p>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Within <span className="text-red-700">{followUp.timeframe ?? "Not specified"}</span>
              </h3>
              {followUp.reason && (
                <p className="text-sm text-slate-700 leading-relaxed">{followUp.reason}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Lifestyle Recommendations</p>
          {Object.keys(grouped).length === 0 && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-400">
              No lifestyle recommendations available
            </div>
          )}
          {Object.entries(grouped).map(([type, recs]) => {
            const style = LIFESTYLE_STYLE[type] ?? LIFESTYLE_STYLE.default;
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold h-7 px-2 rounded border border-slate-300 bg-white text-slate-700 flex items-center">{style.icon}</span>
                  <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${style.badge}`}>{type}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recs.map((rec, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setActiveDrawer(
                          activeDrawer === rec.recommendation_text ? null : rec.recommendation_text
                        )
                      }
                      className={`rounded-xl border-2 p-4 text-left transition-all hover:shadow-md cursor-pointer group ${style.bg} ${style.border} ${
                        activeDrawer === rec.recommendation_text ? "ring-2 ring-offset-1 ring-red-200 shadow-md" : ""
                      }`}
                    >
                      <p className={`text-sm font-semibold mb-1 ${style.text}`}>{rec.recommendation_text}</p>
                      {rec.target_condition && (
                        <p className="text-[10px] text-slate-500">For: {rec.target_condition}</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1 group-hover:text-slate-600 transition-colors">
                        {activeDrawer === rec.recommendation_text ? "▲ Close" : "▼ Learn more"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Lifestyle Habit Profile</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "#64748b" }} />
                <Radar
                  name="Recommended"
                  dataKey="value"
                  stroke="#991b1b"
                  fill="#991b1b"
                  fillOpacity={0.15}
                  strokeWidth={2}
                  dot={{ fill: "#991b1b", r: 3 }}
                />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-xs">
                      <p className="font-semibold text-slate-800">{payload[0].payload.axis}</p>
                      <p className="text-red-700 font-bold">{payload[0].value}% coverage</p>
                    </div>
                  ) : null
                }
              />
            </RadarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            Showing recommended lifestyle coverage
          </p>
        </div>
      </div>

      {activeDrawer && activeRec && activeStyle && (
        <div className={`rounded-2xl border-2 p-5 ${activeStyle.bg} ${activeStyle.border} animate-fade-in`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-sm font-bold rounded border border-slate-300 bg-white px-2 py-1 text-slate-700">{activeStyle.icon}</span>
              <div>
                <p className={`font-semibold text-base ${activeStyle.text}`}>{activeRec.recommendation_text}</p>
                {activeRec.target_condition && (
                  <p className="text-xs text-slate-500 mt-0.5">Target: {activeRec.target_condition}</p>
                )}
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">Category: {activeRec.type ?? "General"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveDrawer(null)}
              className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 text-xl"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
  Diet: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "🥗", badge: "bg-emerald-100 text-emerald-700", text: "text-emerald-800" },
  Exercise: { bg: "bg-sky-50", border: "border-sky-200", icon: "🏃", badge: "bg-sky-100 text-sky-700", text: "text-sky-800" },
  Sleep: { bg: "bg-violet-50", border: "border-violet-200", icon: "🌙", badge: "bg-violet-100 text-violet-700", text: "text-violet-800" },
  Relaxation: { bg: "bg-amber-50", border: "border-amber-200", icon: "🧘", badge: "bg-amber-100 text-amber-700", text: "text-amber-800" },
  Substance: { bg: "bg-red-50", border: "border-red-200", icon: "🚭", badge: "bg-red-100 text-red-700", text: "text-red-800" },
  Substances: { bg: "bg-red-50", border: "border-red-200", icon: "🚭", badge: "bg-red-100 text-red-700", text: "text-red-800" },
  default: { bg: "bg-slate-50", border: "border-slate-200", icon: "💡", badge: "bg-slate-100 text-slate-700", text: "text-slate-800" },
};

const RADAR_AXES = ["Diet", "Exercise", "Sleep", "Relaxation", "Substances"];

export function LifestyleFollowUpTab({ data }: { data: ChestPainLabeledReport }) {
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null);

  const followUp = data.lifestyle_followup?.follow_up;
  const recommendations = data.lifestyle_followup?.lifestyle_recommendations ?? [];

  // Build radar data from recommendations
  const radarData = RADAR_AXES.map((axis) => {
    const recs = recommendations.filter(
      (r) => r.type === axis || r.type === axis.slice(0, -1)
    );
    return {
      axis,
      value: recs.length > 0 ? Math.min(recs.length * 35 + 30, 100) : 15,
    };
  });

  // Group recs by type
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
      {/* Follow-up card */}
      {followUp && (
        <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 via-violet-50 to-purple-50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white border border-indigo-100 flex items-center justify-center text-2xl shadow-sm shrink-0">
              📅
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-1">Follow-up Required</p>
              <h3 className="text-xl font-bold text-indigo-900 mb-2">
                Within <span className="text-indigo-600">{followUp.timeframe ?? "24 hours"}</span>
              </h3>
              {followUp.reason && (
                <p className="text-sm text-indigo-700 leading-relaxed">{followUp.reason}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-700">
                  ⚠️ Rule out cardiac / respiratory disease
                </span>
                <span className="rounded-full bg-white border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-700">
                  📊 Despite normal vitals
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lifestyle tiles grid + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tiles */}
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
                  <span className="text-lg">{style.icon}</span>
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
                        activeDrawer === rec.recommendation_text ? "ring-2 ring-offset-1 ring-indigo-300 shadow-md" : ""
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

        {/* Radar chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Lifestyle Habit Profile</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "#64748b" }} />
              <Radar
                name="Recommended"
                dataKey="value"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={{ fill: "#6366f1", r: 3 }}
              />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-xs">
                      <p className="font-semibold text-slate-800">{payload[0].payload.axis}</p>
                      <p className="text-indigo-600 font-bold">{payload[0].value}% coverage</p>
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

      {/* Bottom drawer for selected recommendation */}
      {activeDrawer && activeRec && activeStyle && (
        <div className={`rounded-2xl border-2 p-5 ${activeStyle.bg} ${activeStyle.border} animate-fade-in`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{activeStyle.icon}</span>
              <div>
                <p className={`font-semibold text-base ${activeStyle.text}`}>{activeRec.recommendation_text}</p>
                {activeRec.target_condition && (
                  <p className="text-xs text-slate-500 mt-0.5">Target: {activeRec.target_condition}</p>
                )}
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  {activeRec.recommendation_text?.toLowerCase().includes("diet") ||
                  activeRec.recommendation_text?.toLowerCase().includes("food")
                    ? "Focus on whole foods and minimize processed meals. For example, swap coffee for herbal tea and replace refined carbs with whole grains."
                    : activeRec.recommendation_text?.toLowerCase().includes("breath") ||
                      activeRec.recommendation_text?.toLowerCase().includes("meditation")
                    ? "Practice daily for 10–15 minutes. Apps like Calm or Headspace offer guided sessions to reduce cortisol and improve autonomic tone."
                    : activeRec.recommendation_text?.toLowerCase().includes("walk") ||
                      activeRec.recommendation_text?.toLowerCase().includes("exercise")
                    ? "Start with 20-minute brisk walks 3–5× per week and gradually build intensity. Low-impact is preferred given the current clinical picture."
                    : "Follow this recommendation consistently to improve your overall cardiovascular and anxiety-related outcomes."}
                </p>
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

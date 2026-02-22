import type { AgentTriage, CarePlanStructured } from "@/api/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";

interface ReportInsightsProps {
  triage: AgentTriage | null;
  carePlan: CarePlanStructured | null;
}

const SEVERITY_COLORS = ["#dc2626", "#ea580c", "#ca8a04", "#65a30d", "#16a34a"];
const CHART_COLORS = ["#b91c1c", "#0d9488", "#2563eb", "#7c3aed", "#64748b"];

export function ReportInsights({ triage, carePlan }: ReportInsightsProps) {
  const severity = triage?.severity_score ?? 3;
  const isRedFlag = triage?.is_red_flag ?? false;
  const diffs = triage?.differential_diagnoses ?? [];
  const meds = carePlan?.medications ?? [];
  const labs = carePlan?.lab_tests ?? [];
  const icdCount = (carePlan?.icd_codes ?? []).length;
  const lifestyleCount = (carePlan?.diet_lifestyle?.recommendations ?? []).length;
  const stepsCount = (carePlan?.treatment_steps ?? []).length;

  const barData = diffs.map((d, i) => ({
    name: d.diagnosis.length > 18 ? d.diagnosis.slice(0, 18) + "…" : d.diagnosis,
    fullName: d.diagnosis,
    value: diffs.length - i,
    reasoning: d.reasoning,
  }));

  const pieData = [
    { name: "Medications", value: meds.length, fill: CHART_COLORS[0] },
    { name: "Labs & imaging", value: labs.length, fill: CHART_COLORS[1] },
    { name: "ICD codes", value: icdCount, fill: CHART_COLORS[2] },
    { name: "Lifestyle", value: lifestyleCount, fill: CHART_COLORS[3] },
    { name: "Treatment steps", value: stepsCount, fill: CHART_COLORS[4] },
  ].filter((d) => d.value > 0);

  const totalCare = meds.length + labs.length + icdCount + lifestyleCount + stepsCount;
  const progressItems = [
    { label: "Differential diagnoses", value: diffs.length, max: 6, pct: Math.min(100, (diffs.length / 6) * 100) },
    { label: "Medications", value: meds.length, max: 8, pct: Math.min(100, (meds.length / 8) * 100) },
    { label: "Lab tests", value: labs.length, max: 6, pct: Math.min(100, (labs.length / 6) * 100) },
    { label: "ICD-10 codes", value: icdCount, max: 6, pct: Math.min(100, (icdCount / 6) * 100) },
    { label: "Care plan items", value: totalCare, max: 15, pct: Math.min(100, (totalCare / 15) * 100) },
  ];

  const severityBars = [1, 2, 3, 4, 5].map((s) => ({
    level: s,
    fill: s === severity ? SEVERITY_COLORS[s - 1] : "#e2e8f0",
  }));

  if (!triage && !carePlan) {
    return (
      <div className="rounded-xl border border-clinical-border bg-white p-8 text-center text-clinical-muted text-sm">
        No report data to visualize.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-clinical-border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-clinical-muted uppercase tracking-wider">Severity</p>
          <p className="mt-1 text-3xl font-bold text-gray-900 tabular-nums" style={{ color: SEVERITY_COLORS[severity - 1] }}>
            {severity}
          </p>
          <p className="text-xs text-clinical-muted">of 5 (1 = highest acuity)</p>
        </div>
        <div className="rounded-xl border border-clinical-border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-clinical-muted uppercase tracking-wider">Differentials</p>
          <p className="mt-1 text-3xl font-bold text-gray-900 tabular-nums">{diffs.length}</p>
          <p className="text-xs text-clinical-muted">diagnoses considered</p>
        </div>
        <div className="rounded-xl border border-clinical-border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-clinical-muted uppercase tracking-wider">Red flags</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${isRedFlag ? "text-red-600" : "text-emerald-600"}`}>
            {isRedFlag ? "Yes" : "None"}
          </p>
        </div>
        <div className="rounded-xl border border-clinical-border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-clinical-muted uppercase tracking-wider">Care plan</p>
          <p className="mt-1 text-3xl font-bold text-gray-900 tabular-nums">{totalCare}</p>
          <p className="text-xs text-clinical-muted">total items</p>
        </div>
      </div>

      {/* Severity scale + Area-style "risk" visual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-clinical-border bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Severity scale</h3>
          <div className="flex justify-between text-xs text-clinical-muted mb-2">
            <span>1 (highest)</span>
            <span>5 (lowest)</span>
          </div>
          <div className="h-4 rounded-full overflow-hidden flex gap-0.5">
            {severityBars.map((s) => (
              <div
                key={s.level}
                className="flex-1 h-full rounded-sm transition-colors"
                style={{ backgroundColor: s.fill }}
                title={`Level ${s.level}`}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Current acuity: <span className="font-semibold" style={{ color: SEVERITY_COLORS[severity - 1] }}>{severity}</span>
          </p>
        </div>

        <div className="rounded-xl border border-clinical-border bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Care plan breakdown</h3>
          {pieData.length === 0 ? (
            <p className="text-sm text-clinical-muted">No care plan categories.</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieData.map((e, i) => (
                      <Cell key={i} fill={e.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number | undefined, n: string | undefined) => [v ?? 0, n ?? ""]} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Differential diagnoses bar chart */}
      {barData.length > 0 && (
        <div className="rounded-xl border border-clinical-border bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Differential diagnoses</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <XAxis type="number" domain={[0, "auto"]} hide />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.[0]?.payload ? (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
                        <div className="font-medium text-gray-900">{payload[0].payload.fullName}</div>
                        {payload[0].payload.reasoning && (
                          <div className="text-clinical-muted mt-1 max-w-xs">{payload[0].payload.reasoning}</div>
                        )}
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="value" radius={4}>
                  {barData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Progress-style row */}
      <div className="rounded-xl border border-clinical-border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Report coverage</h3>
        <div className="space-y-4">
          {progressItems.map((item, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-32 shrink-0 text-sm text-gray-700">{item.label}</div>
              <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${item.pct}%`,
                    backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
              </div>
              <div className="w-16 text-right text-sm font-medium text-gray-900 tabular-nums">
                {item.value}
                <span className="text-clinical-muted font-normal"> / {item.max}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Simple trend-style area (severity as single point "distribution") */}
      <div className="rounded-xl border border-clinical-border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Acuity overview</h3>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={[1, 2, 3, 4, 5].map((s) => ({
                level: s,
                acuity: s === severity ? 100 : 0,
                ref: s,
              }))}
              margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
            >
              <defs>
                <linearGradient id="acuityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#b91c1c" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#b91c1c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="level"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `Level ${v}`}
              />
              <YAxis hide domain={[0, 100]} />
              <Tooltip
                formatter={(v: number | undefined, _n: string | undefined) => [v ? "Current acuity" : "", ""]}
                labelFormatter={(l) => `Severity level ${l}`}
              />
              <Area type="monotone" dataKey="acuity" stroke="#b91c1c" fill="url(#acuityGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-clinical-muted mt-2 text-center">
          Peak indicates current severity level ({severity}) on 1–5 scale.
        </p>
      </div>
    </div>
  );
}

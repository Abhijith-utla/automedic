import { AgentTriage } from "@/api/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface TriageOverviewProps {
  triage: AgentTriage | null;
}

const SEVERITY_COLORS = ["#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444"];

export function TriageOverview({ triage }: TriageOverviewProps) {
  if (!triage) return null;
  const severity = triage.severity_score ?? 3;
  const diffs = triage.differential_diagnoses ?? [];
  const thoughtSteps = triage.thought_process ?? [];

  const barData = diffs.map((d) => ({
    name: d.diagnosis.length > 20 ? d.diagnosis.slice(0, 20) + "…" : d.diagnosis,
    fullName: d.diagnosis,
    value: 1,
    reasoning: d.reasoning,
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-clinical-border bg-clinical-surface p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Severity & status</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs text-clinical-muted mb-1">
              <span>1 (highest acuity)</span>
              <span>5 (lowest)</span>
            </div>
            <div className="h-3 rounded-full bg-gray-200 overflow-hidden flex">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className="flex-1 h-full"
                  style={{
                    backgroundColor: s === severity ? SEVERITY_COLORS[severity - 1] : "rgb(229 231 235)",
                  }}
                />
              ))}
            </div>
            <p className="mt-2 text-sm font-medium text-gray-900">
              Severity: {severity} {triage.is_red_flag ? "· Concerning findings" : "· No red flags"}
            </p>
          </div>
        </div>
      </div>

      {triage.clinical_assessment && (
        <div className="rounded-xl border border-clinical-border bg-clinical-surface p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Clinical assessment</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{triage.clinical_assessment}</p>
        </div>
      )}

      {diffs.length > 0 && (
        <div className="rounded-xl border border-clinical-border bg-clinical-surface p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Differential diagnoses</h3>
          <div className="space-y-3">
            {diffs.map((d, i) => (
              <div
                key={i}
                className="rounded-lg border border-clinical-border bg-gray-50/50 p-3"
              >
                <div className="font-medium text-gray-900">{d.diagnosis}</div>
                {d.reasoning && (
                  <div className="text-sm text-clinical-muted mt-1">→ {d.reasoning}</div>
                )}
              </div>
            ))}
          </div>
          {barData.length > 0 && (
            <div className="mt-4" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={() => null}
                    content={({ active, payload }) =>
                      active && payload?.[0]?.payload ? (
                        <div className="bg-white border rounded shadow p-2 text-xs">
                          <div className="font-medium">{payload[0].payload.fullName}</div>
                          {payload[0].payload.reasoning && (
                            <div className="text-clinical-muted mt-1">{payload[0].payload.reasoning}</div>
                          )}
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="value" radius={4}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill="#b91c1c" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {thoughtSteps.length > 0 && (
        <div className="rounded-xl border border-clinical-border bg-clinical-surface p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Thought process</h3>
          <ol className="space-y-2">
            {thoughtSteps.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="shrink-0 w-6 h-6 rounded-full bg-clinical-primary/15 text-clinical-primary flex items-center justify-center text-xs font-medium">
                  {i + 1}
                </span>
                <span className="text-gray-700">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

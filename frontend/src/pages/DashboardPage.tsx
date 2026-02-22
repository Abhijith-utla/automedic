import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getDiagnosis,
  getEncounter,
  getPatientTimeline,
  getAgentReport,
  runClinicalReport,
  syncToChart,
  acceptReport,
  submitFollowUp,
  type DiagnosisData,
  type EncounterData,
  type TimelineEntry,
  type AgentReport,
  type AgentTriage,
  type CarePlanStructured,
  type PipelineJsonReport,
} from "@/api/client";
import { ConflictAlert, SyncConfirmModal, FollowUpModal } from "@/components/dashboard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
} from "recharts";

/** Vitals from agent1_triage.vitals (backend may nest it). */
type VitalsMap = {
  temperature?: number | null;
  heart_rate?: number | null;
  respiratory_rate?: number | null;
  blood_pressure?: string | null;
  oxygen_sat?: number | null;
  consciousness?: string | null;
  on_oxygen?: boolean;
};

type DashboardNormalized = {
  summary: string;
  triage: AgentTriage | null;
  carePlan: CarePlanStructured | null;
  vitals: VitalsMap | null;
  news2:
    | {
        total_score: number;
        risk_level: string;
        urgency: string;
        breakdown?: Record<string, { value: unknown; score: number; description: string }>;
      }
    | null;
};

function normalizeForDashboard(report: AgentReport | null): DashboardNormalized {
  if (!report) {
    return { summary: "", triage: null, carePlan: null, vitals: null, news2: null };
  }

  const reportAny = report as unknown as Record<string, unknown>;
  const rootPipeline =
    ("triage" in reportAny || "care_plan" in reportAny || "vitals" in reportAny || "news2" in reportAny)
      ? ({
          triage: (reportAny.triage ?? null) as PipelineJsonReport["triage"],
          care_plan: (reportAny.care_plan ?? null) as PipelineJsonReport["care_plan"],
          vitals: (reportAny.vitals ?? null) as PipelineJsonReport["vitals"],
          news2: (reportAny.news2 ?? null) as PipelineJsonReport["news2"],
        } as PipelineJsonReport)
      : null;
  const pipeline = (report.pipeline_json ?? rootPipeline ?? null) as PipelineJsonReport | null;
  const triageFromPipeline = (pipeline?.triage ?? null) as AgentTriage | null;
  const triage = (report.agent1_triage ?? triageFromPipeline ?? null) as AgentTriage | null;
  const vitals = ((triage as AgentTriage & { vitals?: VitalsMap })?.vitals ?? pipeline?.vitals ?? null) as VitalsMap | null;
  const news2 = (triage?.news2 ?? pipeline?.news2 ?? null) as DashboardNormalized["news2"];

  let carePlan = report.care_plan_structured ?? null;
  if (!carePlan && pipeline?.care_plan) {
    const cp = pipeline.care_plan;
    carePlan = {
      treatment_steps: cp.treatment_plan ? [cp.treatment_plan] : [],
      medications: (cp.recommended_medications ?? []).map((m) => ({
        name_dose: (m.name ?? "").trim(),
        indication: (m.indication ?? "").trim(),
        monitor: (m.notes ?? "").trim(),
      })),
      lab_tests: (cp.lab_tests ?? []).map((l) => ({
        name: (l.test ?? "").trim(),
        reason: (l.reason ?? "").trim(),
        priority: "Routine",
        note: "",
      })),
      icd_codes: (cp.icd10_codes ?? []).map((c) => ({
        code: (c.code ?? "").trim().toUpperCase(),
        description: (c.description ?? "").trim(),
      })),
      diet_lifestyle: { recommendations: [] },
      next_visit: (cp.next_visit ?? "").trim(),
      raw: report.agent2_care_plan ?? undefined,
    };
  }

  return {
    summary: report.paragraph_summary ?? "",
    triage,
    carePlan,
    vitals,
    news2,
  };
}

function SeverityGauge({ value, max = 5 }: { value: number; max?: number }) {
  const pct = Math.min(Math.max(value / max, 0), 1);
  const color = pct <= 0.4 ? "#10b981" : pct <= 0.7 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative w-32 h-20 flex justify-center">
      <svg viewBox="0 0 120 80" className="w-full h-full">
        <path
          d="M 20 65 A 50 50 0 0 1 100 65"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 20 65 A 50 50 0 0 1 100 65"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${3.14 * 50 * pct} 999`}
          transform="rotate(180 60 65)"
          style={{ transformOrigin: "60px 65px" }}
        />
      </svg>
      <span className="absolute bottom-0 text-2xl font-bold text-gray-900 tabular-nums">{value}</span>
    </div>
  );
}

function News2Radial({ score, riskLevel }: { score: number; riskLevel: string }) {
  const pct = Math.min(score / 20, 1);
  const color = riskLevel === "High" ? "#ef4444" : riskLevel === "Medium" ? "#f59e0b" : "#10b981";
  return (
    <div className="relative w-28 h-28">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 42 * pct} 999`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-gray-900">{score}</span>
        <span className="text-[10px] text-gray-500 uppercase">{riskLevel}</span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { encounterId } = useParams<{ encounterId: string }>();
  const [encounter, setEncounter] = useState<EncounterData | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
  const [diagnosisLoaded, setDiagnosisLoaded] = useState(false);
  const [agentReport, setAgentReport] = useState<AgentReport | null | undefined>(undefined);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [reportAccepted, setReportAccepted] = useState(false);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [acceptingReport, setAcceptingReport] = useState(false);
  const [followUpSuccess, setFollowUpSuccess] = useState("");
  const [runParagraph, setRunParagraph] = useState("");
  const [runningModel, setRunningModel] = useState(false);
  const [runModelError, setRunModelError] = useState("");
  const [rawExpanded, setRawExpanded] = useState(false);

  useEffect(() => {
    if (!encounterId) return;
    getEncounter(encounterId).then((enc) => {
      setEncounter(enc);
      setReportAccepted(!!enc.report_accepted_at);
      if (enc.patient_id) getPatientTimeline(enc.patient_id).then(setTimeline);
    });
    getDiagnosis(encounterId)
      .then((d) => {
        setDiagnosis(d);
        setDiagnosisLoaded(true);
      })
      .catch(() => {
        // No report yet (404) — use empty shape so page can render "Run model" CTA
        setDiagnosis({
          chief_complaint: "",
          suggestions: [],
          clinical_plan: [],
          conflicts: [],
          ddx_alerts: [],
          evidence_links: [],
          drug_interaction_flags: [],
        });
        setDiagnosisLoaded(true);
      });
    getAgentReport(encounterId).then((r) => setAgentReport(r.report ?? null));
  }, [encounterId]);

  useEffect(() => {
    if (!encounterId || agentReport !== null) return;
    getEncounter(encounterId).then((enc) => {
      const segs = enc.transcript ?? [];
      const text = segs
        .map((s: { text?: string }) => (typeof s === "string" ? s : (s && "text" in s ? s.text : "")))
        .filter(Boolean)
        .join(" ");
      if (text) setRunParagraph((p) => (p ? p : text));
    });
  }, [encounterId, agentReport]);

  const handleAcceptReport = async () => {
    if (!encounterId) return;
    setAcceptingReport(true);
    try {
      await acceptReport(encounterId);
      setReportAccepted(true);
      setFollowUpModalOpen(true);
    } catch (e) {
      console.error(e);
    } finally {
      setAcceptingReport(false);
    }
  };

  const handleFollowUpSubmit = async (method: "email" | "call", note: string) => {
    if (!encounterId) return;
    await submitFollowUp(encounterId, method, note);
    setEncounter((e) => (e ? { ...e, follow_up: { method, note, at: new Date().toISOString() } } : e));
  };

  const handleSyncToChart = async () => {
    if (!encounterId || !diagnosis) return;
    setSyncing(true);
    try {
      await syncToChart(encounterId, {
        confirmed_diagnoses: diagnosis.suggestions,
        clinical_plan: diagnosis.clinical_plan,
      });
      setSynced(true);
      setSyncModalOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  const handleRunModel = async () => {
    if (!runParagraph.trim() || !encounterId) return;
    setRunningModel(true);
    setRunModelError("");
    try {
      const result = await runClinicalReport(runParagraph.trim(), encounterId);
      setAgentReport({
        paragraph_summary: result.paragraph_summary,
        agent1_triage: result.agent1_triage ?? null,
        agent2_care_plan: result.agent2_care_plan ?? null,
        care_plan_structured: result.care_plan_structured ?? null,
        pipeline_json: result.pipeline_json ?? null,
        raw_output: result.raw_output,
        parse_failed: result.parse_failed,
      });
      // Refetch diagnosis (backend fills it from agent output)
      getDiagnosis(encounterId).then(setDiagnosis);
    } catch (e) {
      setRunModelError(e instanceof Error ? e.message : "Failed to run model");
    } finally {
      setRunningModel(false);
    }
  };

  if (!encounterId) {
    return (
      <div className="p-6 text-clinical-muted">
        No encounter. <Link to="/patients" className="text-clinical-primary hover:underline">Back to patients</Link>.
      </div>
    );
  }

  if (!diagnosisLoaded || diagnosis === null) {
    return <div className="p-6 text-clinical-muted">Loading…</div>;
  }

  const hasAgentReport = agentReport !== null && agentReport !== undefined;

  // Use only real agent report for analysis – no synthetic/mock data
  const normalized = hasAgentReport ? normalizeForDashboard(agentReport!) : null;
  const triage: AgentTriage | null = normalized?.triage ?? null;
  const carePlan: CarePlanStructured | null = normalized?.carePlan ?? null;
  const rawOutput = hasAgentReport ? (agentReport as AgentReport & { raw_output?: string }).raw_output : undefined;
  const parseFailed = hasAgentReport ? (agentReport as AgentReport & { parse_failed?: boolean }).parse_failed : false;

  const summary = normalized?.summary ?? "";
  const assessment = triage?.clinical_assessment ?? "";
  const diffs = triage?.differential_diagnoses ?? [];
  const severity = triage?.severity_score ?? 3;
  const isRedFlag = triage?.is_red_flag ?? false;
  const news2 = normalized?.news2 ?? null;
  const thoughtProcess = triage?.thought_process ?? [];
  const riskFactors = Array.isArray(triage?.risk_factors) ? triage.risk_factors : [];
  const vitals: VitalsMap | null = normalized?.vitals ?? null;

  const steps = carePlan?.treatment_steps ?? [];
  const meds = carePlan?.medications ?? [];
  const labs = carePlan?.lab_tests ?? [];
  const icdCodes = carePlan?.icd_codes ?? [];
  const lifestyleRecs = carePlan?.diet_lifestyle?.recommendations ?? [];
  const nextVisit = carePlan?.next_visit ?? "";

  // Chart data from real JSON
  const differentialBarData = diffs.map((d, i) => ({
    name: d.diagnosis.length > 20 ? d.diagnosis.slice(0, 20) + "…" : d.diagnosis,
    fullName: d.diagnosis,
    index: i + 1,
    count: diffs.length - i,
  }));
  const radarData = diffs.map((d, i) => ({
    subject: d.diagnosis.length > 12 ? d.diagnosis.slice(0, 12) + "…" : d.diagnosis,
    fullName: d.diagnosis,
    value: diffs.length - i,
    fill: ["#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f59e0b"][i % 5],
  }));
  const riskFactorChartData = riskFactors.length
    ? riskFactors.map((r, i) => ({ factor: r.length > 25 ? r.slice(0, 25) + "…" : r, value: riskFactors.length - i }))
    : [];
  const vitalsCompleteness = vitals
    ? {
        captured: [
          vitals.temperature,
          vitals.heart_rate,
          vitals.respiratory_rate,
          vitals.blood_pressure,
          vitals.oxygen_sat,
        ].filter((v) => v !== null && v !== undefined).length,
        total: 5,
      }
    : null;
  const carePlanMixData = [
    { name: "Meds", value: meds.length },
    { name: "Labs", value: labs.length },
    { name: "ICD", value: icdCodes.length },
    { name: "Lifestyle", value: lifestyleRecs.length },
    { name: "Steps", value: steps.length },
  ].filter((x) => x.value > 0);
  const acuityTrendData = thoughtProcess.map((_, i) => ({
    step: `S${i + 1}`,
    acuity: Math.max(1, 6 - Math.min(5, severity + (i > 2 ? 1 : 0))),
  }));

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-clinical-border bg-clinical-surface px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-900">Clinical report</h1>
        <div className="flex flex-wrap items-center gap-2">
          {encounter?.patient_id && (
            <Link to={`/patients/${encounter.patient_id}`} className="text-sm text-clinical-primary hover:underline">
              Back to patient
            </Link>
          )}
          {!reportAccepted && (
            <button
              type="button"
              onClick={handleAcceptReport}
              disabled={acceptingReport}
              className="rounded-lg bg-clinical-primary text-white px-4 py-2 text-sm font-medium hover:bg-clinical-primaryHover disabled:opacity-50"
            >
              {acceptingReport ? "Accepting…" : "Accept report"}
            </button>
          )}
          {reportAccepted && <span className="text-xs font-medium text-clinical-primary">Report accepted</span>}
          <button
            type="button"
            onClick={() => (synced ? undefined : setSyncModalOpen(true))}
            disabled={syncing || synced}
            className="rounded-lg bg-clinical-primary text-white px-4 py-2 text-sm font-medium hover:bg-clinical-primaryHover disabled:opacity-50"
          >
            {synced ? "Synced" : syncing ? "Syncing…" : "Sync to chart"}
          </button>
          <SyncConfirmModal open={syncModalOpen} onConfirm={handleSyncToChart} onCancel={() => setSyncModalOpen(false)} syncing={syncing} />
          <FollowUpModal
            open={followUpModalOpen}
            onClose={() => { setFollowUpModalOpen(false); setFollowUpSuccess(""); }}
            onSubmit={handleFollowUpSubmit}
            onSuccess={setFollowUpSuccess}
            loading={acceptingReport}
          />
        </div>
      </div>

      {followUpSuccess && (
        <div className="mx-4 mt-3 rounded-lg border border-clinical-statusLowBg bg-clinical-statusLowBg p-3 text-sm text-gray-800">
          {followUpSuccess}
        </div>
      )}
      {diagnosis.conflicts.length > 0 && (
        <div className="mx-4 mt-3 space-y-2">
          {diagnosis.conflicts.map((msg, i) => (
            <ConflictAlert key={i} message={msg} />
          ))}
        </div>
      )}

      {/* Run model CTA – only when no real agent report */}
      {!hasAgentReport && (
        <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900 mb-2">
            Run the clinical model to generate the analysis.
          </p>
          <textarea
            value={runParagraph}
            onChange={(e) => setRunParagraph(e.target.value)}
            placeholder="Paste clinical paragraph or use transcript…"
            className="w-full rounded-lg border border-clinical-border p-2 text-sm min-h-[80px] mb-2"
            rows={3}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunModel}
              disabled={runningModel || !runParagraph.trim()}
              className="rounded-lg bg-clinical-primary text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {runningModel ? "Running…" : "Run model"}
            </button>
            {runModelError && <span className="text-sm text-red-600">{runModelError}</span>}
          </div>
          <div className="mt-4 rounded-lg border border-amber-100 bg-white/60 p-4 text-center text-sm text-amber-800">
            Analysis dashboard (graphs, differentials, care plan) will appear here after the model returns.
          </div>
        </div>
      )}

      {/* Analysis content – only when we have real agent report */}
      {hasAgentReport && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
            {summary && (
              <section>
                <h2 className="text-sm font-semibold text-clinical-muted uppercase tracking-wider mb-2">Encounter summary</h2>
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap rounded-xl border border-clinical-border bg-clinical-surface p-4">
                  {summary}
                </p>
              </section>
            )}

            {/* Key metrics – gauges and illustrations */}
            <section className="rounded-xl border border-clinical-border bg-clinical-surface p-5">
              <h2 className="text-sm font-semibold text-clinical-muted uppercase tracking-wider mb-4">Key metrics</h2>
              <div className="flex flex-wrap items-end justify-around gap-8">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-clinical-muted">Severity</span>
                  <SeverityGauge value={severity} />
                  <span className="text-[10px] text-clinical-muted">/ 5 (1 = highest acuity)</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-clinical-muted">Red flags</span>
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center text-lg font-bold ${isRedFlag ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {isRedFlag ? "Yes" : "None"}
                  </div>
                </div>
                {news2 != null && (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-clinical-muted">NEWS2</span>
                    <News2Radial score={news2.total_score ?? 0} riskLevel={news2.risk_level ?? "Low"} />
                  </div>
                )}
                {vitalsCompleteness && (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-clinical-muted">Vitals captured</span>
                    <div className="w-24 h-24 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center">
                      <span className="text-xl font-semibold text-sky-800">
                        {vitalsCompleteness.captured}/{vitalsCompleteness.total}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {(carePlanMixData.length > 0 || acuityTrendData.length > 0) && (
              <section className="rounded-xl border border-clinical-border bg-clinical-surface p-5">
                <h2 className="text-sm font-semibold text-clinical-muted uppercase tracking-wider mb-4">Clinical visuals</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {carePlanMixData.length > 0 && (
                    <div className="h-56 rounded-xl border border-gray-100 bg-gradient-to-br from-cyan-50 to-emerald-50 p-2">
                      <p className="px-2 pt-1 text-xs font-medium text-gray-600">Care plan composition</p>
                      <ResponsiveContainer width="100%" height="90%">
                        <PieChart>
                          <Pie
                            data={carePlanMixData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={3}
                          >
                            {carePlanMixData.map((_, i) => (
                              <Cell key={i} fill={["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"][i % 5]} />
                            ))}
                          </Pie>
                          <Legend />
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {acuityTrendData.length > 0 && (
                    <div className="h-56 rounded-xl border border-gray-100 bg-gradient-to-br from-indigo-50 to-rose-50 p-2">
                      <p className="px-2 pt-1 text-xs font-medium text-gray-600">Acuity trend across reasoning steps</p>
                      <ResponsiveContainer width="100%" height="90%">
                        <LineChart data={acuityTrendData}>
                          <XAxis dataKey="step" tick={{ fontSize: 11 }} />
                          <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="acuity"
                            stroke="#6366f1"
                            strokeWidth={3}
                            dot={{ fill: "#4338ca", r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Vitals – visual cards when present in JSON */}
            {vitals && (vitals.heart_rate != null || vitals.blood_pressure != null || vitals.oxygen_sat != null || vitals.temperature != null || vitals.consciousness) && (
              <section className="rounded-xl border border-clinical-border bg-clinical-surface p-5">
                <h2 className="text-sm font-semibold text-clinical-muted uppercase tracking-wider mb-4">Vitals</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {vitals.heart_rate != null && (
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">{vitals.heart_rate}</p>
                      <p className="text-xs text-gray-500">Heart rate (bpm)</p>
                    </div>
                  )}
                  {vitals.blood_pressure != null && (
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">{vitals.blood_pressure}</p>
                      <p className="text-xs text-gray-500">BP</p>
                    </div>
                  )}
                  {vitals.oxygen_sat != null && (
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">{vitals.oxygen_sat}%</p>
                      <p className="text-xs text-gray-500">SpO₂</p>
                    </div>
                  )}
                  {vitals.temperature != null && (
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">{vitals.temperature}°C</p>
                      <p className="text-xs text-gray-500">Temp</p>
                    </div>
                  )}
                  {vitals.consciousness != null && (
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
                      <p className="text-lg font-bold text-gray-900">{vitals.consciousness}</p>
                      <p className="text-xs text-gray-500">Consciousness</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Clinical assessment */}
            {assessment && (
              <section>
                <h2 className="text-sm font-semibold text-clinical-muted uppercase tracking-wider mb-2">Clinical assessment</h2>
                <div className="rounded-xl border border-clinical-border bg-clinical-surface p-4">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{assessment}</p>
                </div>
              </section>
            )}

            {/* Differential diagnoses – radar + bar chart */}
            {diffs.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-clinical-muted uppercase tracking-wider mb-3">Differential diagnoses</h2>
                <div className="rounded-xl border border-clinical-border bg-clinical-surface p-4">
                  {diffs.length >= 2 && diffs.length <= 8 && (
                    <div className="h-56 mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                          <PolarRadiusAxis angle={90} domain={[0, diffs.length]} />
                          <Radar name="Rank" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                          <Tooltip labelFormatter={(_, payload) => payload[0]?.payload?.fullName ?? ""} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="h-40 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={differentialBarData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                        <XAxis type="number" domain={[0, diffs.length + 1]} hide />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={() => null} labelFormatter={(_, payload) => payload[0]?.payload?.fullName ?? ""} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#6366f1">
                          {differentialBarData.map((_, i) => (
                            <Cell key={i} fill={["#6366f1", "#8b5cf6", "#a855f7"][i % 3]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-2">
                    {diffs.map((d, i) => (
                      <li key={i} className="flex gap-3 rounded-lg bg-gray-50/80 p-2">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-clinical-primary/20 text-clinical-primary flex items-center justify-center text-xs font-medium">{i + 1}</span>
                        <div>
                          <p className="font-medium text-gray-900">{d.diagnosis}</p>
                          {d.reasoning && <p className="text-sm text-clinical-muted mt-0.5">{d.reasoning}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* Risk factors – radar or chips */}
            {(riskFactors.length > 0 || thoughtProcess.length > 0) && (
              <section className="rounded-xl border border-clinical-border bg-clinical-surface overflow-hidden">
                <h2 className="text-sm font-semibold text-clinical-muted uppercase tracking-wider p-4 pb-0">Reasoning & risk factors</h2>
                <div className="p-4 space-y-4">
                  {riskFactors.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-clinical-muted mb-2">Risk factors</p>
                      <div className="flex flex-wrap gap-2">
                        {riskFactors.map((r, i) => (
                          <span key={i} className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-sm text-amber-900">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {riskFactors.length > 0 && riskFactorChartData.length > 0 && (
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={riskFactorChartData} margin={{ top: 5, right: 5, left: 5, bottom: 20 }}>
                          <XAxis dataKey="factor" tick={{ fontSize: 10 }} />
                          <YAxis hide />
                          <Tooltip />
                          <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {thoughtProcess.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-clinical-muted mb-2">Thought process</p>
                      <div className="relative pl-5 border-l-2 border-clinical-primary/30 space-y-3">
                        {thoughtProcess.map((s, i) => (
                          <div key={i} className="relative flex gap-3">
                            <span className="absolute -left-5 top-0 w-4 h-4 rounded-full bg-clinical-primary text-white text-[10px] flex items-center justify-center font-medium">
                              {i + 1}
                            </span>
                            <p className="text-sm text-gray-700 pt-0.5">{s}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Care plan */}
            <section>
              <h2 className="text-sm font-semibold text-clinical-muted uppercase tracking-wider mb-3">Care plan</h2>
              <div className="rounded-xl border border-clinical-border bg-clinical-surface overflow-hidden">
                {steps.length > 0 && (
                  <div className="p-4 border-b border-clinical-border">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Treatment steps</h3>
                    <ol className="space-y-2">
                      {steps.map((step, i) => (
                        <li key={i} className="flex gap-3 text-sm text-gray-800">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-clinical-primary/15 text-clinical-primary flex items-center justify-center text-xs font-medium">{i + 1}</span>
                          {typeof step === "string" ? step : String(step)}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {meds.length > 0 && (
                  <div className="p-4 border-b border-clinical-border">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Medications</h3>
                    <ul className="space-y-2">
                      {meds.map((m, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-medium text-gray-900">{m.name_dose}</span>
                          {m.indication && <span className="text-clinical-muted ml-1">— {m.indication}</span>}
                          {m.monitor && <p className="text-xs text-clinical-muted mt-0.5">Monitor: {m.monitor}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {labs.length > 0 && (
                  <div className="p-4 border-b border-clinical-border">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Labs & imaging</h3>
                    <ul className="space-y-2">
                      {labs.map((l, i) => (
                        <li key={i} className="text-sm flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">{l.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${l.priority === "Urgent" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700"}`}>{l.priority}</span>
                          {l.reason && <span className="text-clinical-muted text-xs">{l.reason}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {icdCodes.length > 0 && (
                  <div className="p-4 border-b border-clinical-border">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">ICD-10 codes</h3>
                    <div className="flex flex-wrap gap-2">
                      {icdCodes.map((c, i) => (
                        <div key={i} className="flex gap-2 rounded-lg border border-clinical-border bg-gray-50/80 px-3 py-2 text-sm">
                          <span className="font-mono font-semibold text-clinical-primary">{c.code}</span>
                          <span className="text-gray-700">{c.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {lifestyleRecs.length > 0 && (
                  <div className="p-4 border-b border-clinical-border">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Diet & lifestyle</h3>
                    <ul className="space-y-1 text-sm text-gray-700">
                      {lifestyleRecs.map((r, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-clinical-primary shrink-0">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {nextVisit && (
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">Next visit</h3>
                    <p className="text-sm text-gray-700">{nextVisit}</p>
                  </div>
                )}
                {steps.length === 0 && meds.length === 0 && labs.length === 0 && icdCodes.length === 0 && lifestyleRecs.length === 0 && !nextVisit && (
                  <div className="p-4 text-sm text-clinical-muted">No care plan items in report.</div>
                )}
              </div>
            </section>

            {/* Previous records */}
            {timeline.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-clinical-muted uppercase tracking-wider mb-2">Previous records</h2>
                <ul className="rounded-xl border border-clinical-border bg-clinical-surface divide-y divide-clinical-border overflow-hidden">
                  {timeline.slice(0, 8).map((e) => (
                    <li key={e.id} className="flex gap-4 px-4 py-3 text-sm hover:bg-gray-50/80">
                      <span className="text-clinical-muted shrink-0 w-24">{e.date}</span>
                      <span className="text-gray-800 flex-1">{e.summary}</span>
                      {e.type && <span className="text-xs text-clinical-muted shrink-0">{e.type}</span>}
                    </li>
                  ))}
                </ul>
                {timeline.length > 8 && <p className="text-xs text-clinical-muted mt-1">Showing latest 8 of {timeline.length} records.</p>}
              </section>
            )}

            {rawOutput && (
              <section>
                <button type="button" onClick={() => setRawExpanded((x) => !x)} className="text-sm font-medium text-clinical-primary hover:underline">
                  {rawExpanded ? "Hide" : "Show"} raw model output
                  {parseFailed && " (structured parse failed)"}
                </button>
                {rawExpanded && (
                  <pre className="mt-2 rounded-xl border border-clinical-border bg-gray-50 p-4 text-xs text-gray-800 whitespace-pre-wrap overflow-x-auto max-h-[50vh] overflow-y-auto">
                    {rawOutput}
                  </pre>
                )}
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

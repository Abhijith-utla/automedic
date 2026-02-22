import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getAgentReport,
  runClinicalReport,
  getEncounter,
  type AgentReport,
} from "@/api/client";
import { agentReportToChestPainLabeled } from "@/pages/newpages/agentReportToChestPainLabeled";
import { chestPainDemoReport, DEFAULT_RUN_PARAGRAPH } from "@/pages/newpages/chestPainDemoReport";
import type { ChestPainLabeledReport } from "@/types/chestPainLabeled";

const SIDEBAR_BG = "#1e3a5f";
const SIDEBAR_ACTIVE_BG = "rgba(45, 212, 191, 0.2)";
const formatDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export function JourneyDashboardPage() {
  const { encounterId } = useParams<{ encounterId: string }>();
  const [report, setReport] = useState<AgentReport | null | undefined>(undefined);
  const [runParagraph, setRunParagraph] = useState(DEFAULT_RUN_PARAGRAPH);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");

  const labeledData = useMemo<ChestPainLabeledReport>(() => {
    if (report === null || report === undefined) return chestPainDemoReport;
    return agentReportToChestPainLabeled(report);
  }, [report]);

  const hasReport = report !== null && report !== undefined;
  const summary = labeledData.case_summary;
  const triage = labeledData.triage;
  const news2Score = labeledData.vitals_risk?.news2?.total_score ?? 0;
  const news2Risk = labeledData.vitals_risk?.news2?.risk_level ?? "Low";
  const severityScore =
    typeof (report?.agent1_triage as { severity_score?: number } | null)?.severity_score === "number"
      ? (report?.agent1_triage as { severity_score: number }).severity_score
      : 3;
  const isRedFlag =
    (report?.agent1_triage as { is_red_flag?: boolean } | null)?.is_red_flag ?? summary?.red_flag_present ?? false;

  useEffect(() => {
    if (!encounterId) return;
    getAgentReport(encounterId).then((r) => setReport(r.report ?? null));
  }, [encounterId]);

  useEffect(() => {
    if (!encounterId || report !== null) return;
    getEncounter(encounterId).then((enc) => {
      const segs = enc.transcript ?? [];
      const text = segs
        .map((s: { text?: string }) => (typeof s === "string" ? s : (s && "text" in s ? s.text : "")))
        .filter(Boolean)
        .join(" ");
      if (text) setRunParagraph((p) => (p ? p : text));
    });
  }, [encounterId, report]);

  const handleRunModel = async () => {
    if (!runParagraph.trim() || !encounterId) return;
    setRunning(true);
    setRunError("");
    try {
      const result = await runClinicalReport(runParagraph.trim(), encounterId);
      setReport({
        paragraph_summary: result.paragraph_summary,
        agent1_triage: result.agent1_triage ?? null,
        agent2_care_plan: result.agent2_care_plan ?? null,
        care_plan_structured: result.care_plan_structured ?? null,
        raw_output: result.raw_output,
        parse_failed: result.parse_failed,
      });
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Failed to run model");
    } finally {
      setRunning(false);
    }
  };

  if (!encounterId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <p className="text-slate-500 mb-3">No encounter selected.</p>
          <Link to="/patients" className="text-[#1e3a5f] font-semibold hover:underline">
            Back to patients
          </Link>
        </div>
      </div>
    );
  }

  if (report === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Loading clinical report…</p>
        </div>
      </div>
    );
  }

  const differentials = labeledData.differentials?.differentials ?? [];
  const medications = labeledData.medications?.medications ?? [];
  const investigations = labeledData.workup?.investigations ?? [];
  const icdCodes = labeledData.icd_codes?.icd_codes ?? [];
  const thoughtProcess = triage?.thought_process ?? [];
  const followUp = labeledData.lifestyle_followup?.follow_up;
  const treatmentPlan = labeledData.lifestyle_followup?.treatment_plan;
  const vitals = labeledData.vitals_risk?.vitals;

  return (
    <div className="min-h-screen flex bg-[#f1f5f9]">
      {/* Dark blue sidebar */}
      <aside
        className="w-56 shrink-0 flex flex-col text-white overflow-y-auto"
        style={{ backgroundColor: SIDEBAR_BG }}
      >
        <div className="p-4 border-b border-white/10">
          <Link
            to={`/encounter/${encounterId}/dashboard`}
            className="text-sm text-white/80 hover:text-white"
          >
            ← Dashboard
          </Link>
        </div>
        {!hasReport && (
          <div className="p-4 border-b border-white/10">
            <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">
              Demo mode
            </p>
            <textarea
              value={runParagraph}
              onChange={(e) => setRunParagraph(e.target.value)}
              placeholder="Paste clinical paragraph…"
              className="w-full rounded-lg border border-white/20 bg-white/10 p-2 text-xs text-white placeholder-white/50 min-h-[72px] mb-2 resize-none focus:ring-1 focus:ring-teal-400"
              rows={3}
            />
            <button
              type="button"
              onClick={handleRunModel}
              disabled={running || !runParagraph.trim()}
              className="w-full rounded-lg py-2.5 text-sm font-semibold bg-teal-500 text-white hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? "Running…" : "Run clinical model"}
            </button>
            {runError && <p className="mt-2 text-xs text-red-300">{runError}</p>}
          </div>
        )}
        <nav className="flex-1 p-3 space-y-0.5">
          <div
            className="flex items-center gap-3 rounded-lg px-4 py-3 font-medium"
            style={{ backgroundColor: SIDEBAR_ACTIVE_BG }}
          >
            <span className="text-lg">◉</span>
            <span>Dashboard</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-white/70 hover:bg-white/10">
            <span className="text-lg opacity-80">◈</span>
            <span>Vitals & Risk</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-white/70 hover:bg-white/10">
            <span className="text-lg opacity-80">◇</span>
            <span>Differentials</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-white/70 hover:bg-white/10">
            <span className="text-lg opacity-80">▣</span>
            <span>Medications & ICD</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-white/70 hover:bg-white/10">
            <span className="text-lg opacity-80">◎</span>
            <span>Follow-up</span>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* White header */}
        <header className="shrink-0 h-14 px-6 flex items-center justify-between bg-white border-b border-slate-200">
          <span className="text-slate-500 text-sm">{formatDate(new Date())}</span>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 cursor-pointer" title="Notifications">🔔</span>
            <span className="text-slate-400 cursor-pointer" title="Messages">✉</span>
            <span className="text-sm font-medium text-slate-700">Clinician</span>
            <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 text-xs font-medium">
              U
            </div>
            <span className="text-slate-400 cursor-pointer">▾</span>
          </div>
        </header>

        {/* Main content – card grid like reference */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Section: KEY METRICS – 3 gradient cards */}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Key metrics
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-5 text-white shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-3xl font-bold tabular-nums">{severityScore}</p>
                    <p className="text-blue-100 text-sm mt-0.5">Severity score (1–5)</p>
                  </div>
                  <span className="text-4xl opacity-80">📊</span>
                </div>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-2xl font-bold">{isRedFlag ? "Yes" : "No"}</p>
                    <p className="text-emerald-100 text-sm mt-0.5">Red flag</p>
                  </div>
                  <span className="text-4xl opacity-80">🚩</span>
                </div>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 p-5 text-white shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-3xl font-bold tabular-nums">{news2Score}</p>
                    <p className="text-violet-100 text-sm mt-0.5">NEWS2 · {news2Risk}</p>
                  </div>
                  <span className="text-4xl opacity-80">🩺</span>
                </div>
              </div>
            </div>

            {/* Section: CLINICAL ASSESSMENT */}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Clinical assessment
            </p>
            <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
              <p className="text-slate-700 leading-relaxed">
                {triage?.clinical_assessment ??
                  summary?.paragraph_summary ??
                  "No assessment available."}
              </p>
            </div>

            {/* Section: VITALS OVERVIEW – small cards with progress dots */}
            {vitals && (
              <>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Vitals overview
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {[
                    { label: "Heart rate", value: vitals.heart_rate != null ? `${vitals.heart_rate} bpm` : "—", color: "bg-rose-400" },
                    { label: "BP", value: vitals.blood_pressure_systolic != null ? `${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic ?? ""}` : "—", color: "bg-blue-400" },
                    { label: "SpO₂", value: vitals.oxygen_sat != null ? `${vitals.oxygen_sat}%` : "—", color: "bg-emerald-400" },
                    { label: "Temp", value: vitals.temperature != null ? `${vitals.temperature}°C` : "—", color: "bg-amber-400" },
                    { label: "Consciousness", value: vitals.consciousness ?? "—", color: "bg-violet-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl bg-white p-4 shadow-sm border border-slate-100">
                      <p className="text-2xl font-bold text-slate-800">{value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                      <div className="flex gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <span key={i} className={`w-1.5 h-1.5 rounded-full ${value !== "—" ? color : "bg-slate-200"}`} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* DIFFERENTIAL DIAGNOSES – list card */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Differential diagnoses
                </p>
                <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
                  {differentials.length === 0 ? (
                    <p className="text-slate-400 text-sm">None listed</p>
                  ) : (
                    <ul className="space-y-3">
                      {differentials.map((d, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="text-slate-300 mt-0.5">○</span>
                          <div>
                            <p className="font-medium text-slate-800">{d.diagnosis}</p>
                            {d.reasoning && (
                              <p className="text-sm text-slate-500 mt-0.5">{d.reasoning}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* RECOMMENDED MEDICATIONS – list card */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Recommended medications
                </p>
                <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
                  {medications.length === 0 ? (
                    <p className="text-slate-400 text-sm">None listed</p>
                  ) : (
                    <ul className="space-y-3">
                      {medications.map((m, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="text-slate-300 mt-0.5">○</span>
                          <div>
                            <p className="font-medium text-slate-800">{m.name}</p>
                            {m.dose && <p className="text-sm text-slate-600">{m.dose}</p>}
                            {m.indication && (
                              <p className="text-sm text-slate-500 mt-0.5">{m.indication}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* LAB TESTS – list card */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                Lab tests
              </p>
              <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
                {investigations.length === 0 ? (
                  <p className="text-slate-400 text-sm">None listed</p>
                ) : (
                  <ul className="space-y-2">
                    {investigations.map((inv, i) => (
                      <li key={i} className="flex justify-between items-start gap-4">
                        <span className="font-medium text-slate-800">{inv.name}</span>
                        <span className="text-sm text-slate-500 text-right shrink-0">
                          {inv.purpose ?? "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* THOUGHT PROCESS / EXPERT TIPS */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Thought process
                </p>
                <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
                  {thoughtProcess.length === 0 ? (
                    <p className="text-slate-400 text-sm">No steps recorded</p>
                  ) : (
                    <ul className="space-y-2 text-sm text-slate-600">
                      {thoughtProcess.map((step, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-slate-400 shrink-0">Step {i + 1}:</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* TREATMENT PLAN & NEXT VISIT */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Treatment & follow-up
                </p>
                <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 space-y-4">
                  {treatmentPlan && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                        Treatment plan
                      </p>
                      <p className="text-slate-700 text-sm leading-relaxed">{treatmentPlan}</p>
                    </div>
                  )}
                  {followUp?.timeframe && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                        Next visit
                      </p>
                      <p className="text-slate-700 font-medium">{followUp.timeframe}</p>
                    </div>
                  )}
                  {!treatmentPlan && !followUp?.timeframe && (
                    <p className="text-slate-400 text-sm">No treatment or follow-up noted</p>
                  )}
                </div>
              </div>
            </div>

            {/* ICD-10 CODES */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                ICD-10 codes
              </p>
              <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
                {icdCodes.length === 0 ? (
                  <p className="text-slate-400 text-sm">None listed</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {icdCodes.map((c, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2"
                      >
                        <span className="font-mono font-semibold text-slate-800">{c.code}</span>
                        <span className="text-slate-500 text-sm ml-2">{c.label ?? ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getAgentReport,
  runClinicalReport,
  getEncounter,
  type AgentReport,
} from "@/api/client";
import { agentReportToChestPainLabeled } from "@/utils/agentReportToChestPainLabeled";
import type { ChestPainLabeledReport } from "@/types/chestPainLabeled";
import {
  OverviewTab,
  VitalsRiskTab,
  DifferentialWorkupTab,
  MedicationsICDTab,
  LifestyleFollowUpTab,
} from "@/components/chestPain";

type TabId = "overview" | "vitals" | "differential" | "medications" | "lifestyle";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "vitals", label: "Vitals & Risk" },
  { id: "differential", label: "Differential & Workup" },
  { id: "medications", label: "Medications & ICD Codes" },
  { id: "lifestyle", label: "Lifestyle & Follow-up" },
];

export function JourneyDashboardPage() {
  const { encounterId } = useParams<{ encounterId: string }>();
  const [report, setReport] = useState<AgentReport | null | undefined>(undefined);
  const [tab, setTab] = useState<TabId>("overview");
  const [runParagraph, setRunParagraph] = useState("");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");

  const labeledData = useMemo<ChestPainLabeledReport | null>(() => {
    if (report === null || report === undefined) return null;
    return agentReportToChestPainLabeled(report);
  }, [report]);

  const hasReport = report !== null && report !== undefined;

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
        pipeline_json: result.pipeline_json ?? null,
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
      <div className="p-6 text-clinical-muted">
        No encounter. <Link to="/patients" className="text-clinical-primary hover:underline">Back to patients</Link>.
      </div>
    );
  }

  if (report === undefined) {
    return <div className="p-6 text-clinical-muted">Loading…</div>;
  }

  return (
    <div className="flex flex-1 min-h-0 bg-clinical-bg">
      <aside className="w-56 shrink-0 border-r border-clinical-border bg-clinical-surface p-4 overflow-y-auto">
        <div className="mb-4">
          <Link
            to={`/encounter/${encounterId}/dashboard`}
            className="text-sm text-clinical-primary hover:underline"
          >
            ← Dashboard
          </Link>
        </div>
        {!hasReport && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-xs text-red-800 mb-2">No report yet. Run the model to generate a real report from LLM output.</p>
            <textarea
              value={runParagraph}
              onChange={(e) => setRunParagraph(e.target.value)}
              placeholder="Paste clinical paragraph…"
              className="w-full rounded border border-amber-200 p-2 text-xs min-h-[60px] mb-2"
              rows={2}
            />
            <button
              type="button"
              onClick={handleRunModel}
              disabled={running || !runParagraph.trim()}
              className="w-full rounded bg-clinical-primary text-white px-2 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {running ? "Running…" : "Run model"}
            </button>
            {runError && <p className="mt-1 text-xs text-red-600">{runError}</p>}
          </div>
        )}
        <nav className="space-y-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`block w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === t.id ? "bg-clinical-primary/15 text-clinical-primary" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 min-w-0 p-6 overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Chest pain – clinical insights</h2>
        {!hasReport || !labeledData ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Report is empty. Click <strong>Run model</strong> to generate a complete report from the LLM response.
          </div>
        ) : (
          <>
            {tab === "overview" && <OverviewTab data={labeledData} />}
            {tab === "vitals" && <VitalsRiskTab data={labeledData} />}
            {tab === "differential" && <DifferentialWorkupTab data={labeledData} />}
            {tab === "medications" && <MedicationsICDTab data={labeledData} />}
            {tab === "lifestyle" && <LifestyleFollowUpTab data={labeledData} />}
          </>
        )}
      </main>
    </div>
  );
}

/**
 * API client for Automedic backend.
 * Base URL is relative; Vite proxy forwards /api and /ws to backend.
 * All requests use credentials: 'include' for auth cookie.
 */

const BASE = "";
const CREDS: RequestCredentials = "include";

export interface User {
  id: string;
  email: string;
  full_name: string;
}

export interface PatientListItem {
  id: string;
  doctor_id: string;
  name: string;
  date_of_birth?: string;
  mrn?: string;
  email?: string;
  phone?: string;
  notes?: string;
  photo_url?: string;
  created_at: string;
  updated_at: string;
  encounter_count: number;
  last_encounter_at?: string;
}

export interface PatientDetail {
  id: string;
  doctor_id: string;
  name: string;
  date_of_birth?: string;
  mrn?: string;
  email?: string;
  phone?: string;
  notes?: string;
  photo_url?: string;
  created_at: string;
  updated_at: string;
}

/** Auth */
async function authError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) return j.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join("; ") || text;
  } catch {
    // ignore
  }
  if (text) return text;
  if (res.status || res.statusText) return `Request failed (${res.status}${res.statusText ? ` ${res.statusText}` : ""})`;
  return "Request failed";
}

export async function login(email: string, password: string): Promise<User> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    credentials: CREDS,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await authError(res));
  return res.json();
}

export async function register(email: string, password: string, full_name: string): Promise<User> {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    credentials: CREDS,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name }),
  });
  if (!res.ok) throw new Error(await authError(res));
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: CREDS });
}

export async function getMe(): Promise<User | null> {
  const res = await fetch(`${BASE}/api/auth/me`, { credentials: CREDS });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Patients */
export async function listPatients(): Promise<PatientListItem[]> {
  const res = await fetch(`${BASE}/api/patients`, { credentials: CREDS });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getPatient(patientId: string): Promise<PatientDetail> {
  const res = await fetch(`${BASE}/api/patients/${patientId}`, { credentials: CREDS });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface PatientProfileTimelineEntry {
  id: string;
  date: string;
  type: string;
  summary: string;
  month_key?: string;
}

export interface PatientProfile {
  patient: PatientDetail & { created_at?: string; updated_at?: string };
  timeline: PatientProfileTimelineEntry[];
  alerts: string[];
}

export async function getPatientProfile(patientId: string): Promise<PatientProfile> {
  const res = await fetch(`${BASE}/api/patients/${patientId}/profile`, { credentials: CREDS });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createPatient(data: { name: string; date_of_birth?: string; mrn?: string; email?: string; phone?: string; notes?: string }): Promise<PatientDetail> {
  const res = await fetch(`${BASE}/api/patients`, {
    method: "POST",
    credentials: CREDS,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Encounters */
export async function createEncounter(patientId: string): Promise<{ encounter_id: string; status: string }> {
  const res = await fetch(`${BASE}/api/encounters`, {
    method: "POST",
    credentials: CREDS,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id: patientId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function endEncounter(
  encounterId: string,
  body?: { transcript?: { text: string; key_terms?: string[] }[]; vision_log?: string[] }
): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/api/encounters/${encounterId}/end`, {
    method: "POST",
    credentials: CREDS,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getEncounter(encounterId: string): Promise<EncounterData> {
  const res = await fetch(`${BASE}/api/encounters/${encounterId}`, { credentials: CREDS });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getDiagnosis(encounterId: string): Promise<DiagnosisData> {
  const res = await fetch(`${BASE}/api/encounters/${encounterId}/diagnosis`, { credentials: CREDS });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function acceptReport(encounterId: string): Promise<{ ok: boolean; report_accepted_at: string }> {
  const res = await fetch(`${BASE}/api/encounters/${encounterId}/accept-report`, {
    method: "POST",
    credentials: CREDS,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function submitFollowUp(
  encounterId: string,
  method: "email" | "call",
  note?: string
): Promise<{ ok: boolean; method: string }> {
  const res = await fetch(`${BASE}/api/encounters/${encounterId}/follow-up`, {
    method: "POST",
    credentials: CREDS,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, note: note ?? "" }),
  });
  if (!res.ok) throw new Error(await authError(res));
  return res.json();
}

export async function syncToChart(encounterId: string, payload: SyncPayload): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/api/encounters/${encounterId}/sync`, {
    method: "POST",
    credentials: CREDS,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, encounter_id: encounterId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getPatientTimeline(patientId: string): Promise<TimelineEntry[]> {
  const res = await fetch(`${BASE}/api/patients/${patientId}/timeline`, { credentials: CREDS });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function getTranscriptionWsUrl(encounterId?: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${proto}//${host}/api/ws/transcription${encounterId ? `?id=${encounterId}` : ""}`;
}

export function getDeviceMonitorWsUrl(encounterId: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${proto}//${host}/api/ws/device/monitor?encounter_id=${encodeURIComponent(encounterId)}`;
}

export async function sendDeviceCommand(command: "start" | "stop" | "ping" | "get_vitals"): Promise<{ ok: boolean; command: string }> {
  const res = await fetch(`${BASE}/api/device/command`, {
    method: "POST",
    credentials: CREDS,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  if (!res.ok) throw new Error(await authError(res));
  return res.json();
}

export async function collectVitalsPreview(
  timeoutSec = 10
): Promise<{
  ok: boolean;
  encounter_id: string;
  duration_sec: number;
  final_hrv?: { bpm?: number; spo2?: number; rmssd?: number; sdnn?: number } | null;
  latest_vitals?: {
    heart_rate?: number | null;
    spo2?: number | null;
    hrv?: number | null;
    rmssd?: number | null;
    sdnn?: number | null;
  } | null;
}> {
  const res = await fetch(`${BASE}/api/device/collect-vitals-preview`, {
    method: "POST",
    credentials: CREDS,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timeout_sec: timeoutSec }),
  });
  if (!res.ok) throw new Error(await authError(res));
  return res.json();
}

/** Types matching backend schemas */
export interface EncounterData {
  encounter_id: string;
  patient_id?: string;
  status: string;
  started_at: string;
  transcript?: { text: string; key_terms?: string[] }[];
  vision_log?: string[];
  report_accepted_at?: string | null;
  follow_up?: { method: string; note: string; at: string } | null;
}

export interface DiagnosisSuggestion {
  condition: string;
  confidence: number;
  icd10_code: string;
  icd10_title?: string;
  source_snippet?: string;
}

export interface ClinicalPlanItem {
  type: string;
  name: string;
  dosage?: string;
  frequency?: string;
  code?: string;
}

export interface PatientFriendlySummary {
  headline: string;
  summary: string;
  steps: string[];
}

export interface DiagnosisData {
  chief_complaint: string;
  clinical_summary?: string;
  suggestions: DiagnosisSuggestion[];
  clinical_plan: ClinicalPlanItem[];
  patient_summary?: PatientFriendlySummary;
  conflicts: string[];
  ddx_alerts: string[];
  evidence_links: { title: string; url: string }[];
  drug_interaction_flags: { drug: string; message: string; severity: string }[];
}

export interface SyncPayload {
  confirmed_diagnoses: DiagnosisSuggestion[];
  clinical_plan: ClinicalPlanItem[];
  notes?: string;
}

export interface TimelineEntry {
  date: string;
  type: string;
  summary: string;
  id: string;
}

/** Agent report (triage + care plan) from clinical model (almost.py) */
export interface AgentTriage {
  severity_score?: number;
  is_red_flag?: boolean;
  clinical_assessment?: string;
  differential_diagnoses?: { diagnosis: string; reasoning: string }[];
  thought_process?: string[];
  risk_factors?: string[];
  news2?: {
    total_score: number;
    risk_level: string;
    urgency: string;
    breakdown?: Record<string, { value: unknown; score: number; description: string }>;
  };
}

export interface CarePlanStructured {
  treatment_steps: string[];
  medications: { name_dose: string; indication: string; monitor: string }[];
  lab_tests: { name: string; reason: string; priority: string; note: string }[];
  icd_codes: { code: string; description: string }[];
  diet_lifestyle: { recommendations: string[] };
  next_visit: string;
  raw?: Record<string, string>;
}

export interface PipelineJsonReport {
  vitals?: {
    temperature?: number | null;
    heart_rate?: number | null;
    respiratory_rate?: number | null;
    blood_pressure?: string | null;
    oxygen_sat?: number | null;
    consciousness?: string | null;
    on_oxygen?: boolean;
  } | null;
  news2?: {
    total_score: number;
    risk_level: string;
    urgency: string;
    breakdown?: Record<string, { value: unknown; score: number; description: string }>;
  } | null;
  triage?: AgentTriage | null;
  care_plan?: {
    treatment_plan?: string;
    recommended_medications?: { name?: string; indication?: string; notes?: string }[];
    lab_tests?: { test?: string; reason?: string }[];
    icd10_codes?: { code?: string; description?: string }[];
    next_visit?: string;
  } | null;
}

export interface AgentReport {
  paragraph_summary?: string;
  agent1_triage: AgentTriage | null;
  agent2_care_plan: Record<string, string> | null;
  care_plan_structured: CarePlanStructured | null;
  /** Raw triage pipeline JSON shape: vitals/news2/triage/care_plan. */
  pipeline_json?: PipelineJsonReport | null;
  /** Full raw text from model script when parsing failed; use for display or later processing. */
  raw_output?: string;
  /** True when structured fields are null but raw_output is present. */
  parse_failed?: boolean;
}

/** Timeout for clinical report (model can take 2–10 min). */
const CLINICAL_REPORT_TIMEOUT_MS = 600_000; // 10 min

/**
 * Run clinical report with live progress (SSE). Calls onProgress(message) for each update.
 * Returns the final report on success. Use for loading screen with live updates.
 */
export async function runClinicalReportStream(
  paragraph: string,
  encounterId?: string,
  onProgress?: (message: string) => void
): Promise<AgentReport & { ok: boolean }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLINICAL_REPORT_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/api/clinical-report/stream`, {
      method: "POST",
      credentials: CREDS,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paragraph: paragraph.trim(),
        encounter_id: encounterId || null,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const raw = await res.text();
      let err = raw || "Clinical report failed";
      try {
        const j = JSON.parse(raw);
        if (typeof j.detail === "string") err = j.detail;
      } catch {
        // use raw
      }
      throw new Error(err);
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6)) as { event: string; message?: string; detail?: string } & AgentReport & { ok?: boolean };
            if (data.event === "progress" && data.message) {
              onProgress?.(data.message);
            } else if (data.event === "error") {
              throw new Error(data.detail ?? "Stream error");
            } else if (data.event === "result") {
              return {
                ok: true,
                paragraph_summary: data.paragraph_summary,
                agent1_triage: data.agent1_triage ?? null,
                agent2_care_plan: data.agent2_care_plan ?? null,
                care_plan_structured: data.care_plan_structured ?? null,
                pipeline_json: data.pipeline_json ?? null,
                raw_output: data.raw_output,
                parse_failed: data.parse_failed ?? false,
              };
            }
          } catch (e) {
            if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
          }
        }
      }
    }
    throw new Error("Stream ended without result");
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Request timed out. The model may still be running; check the dashboard in a minute.");
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function runClinicalReport(
  paragraph: string,
  encounterId?: string
): Promise<AgentReport & { ok: boolean }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLINICAL_REPORT_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/api/clinical-report`, {
      method: "POST",
      credentials: CREDS,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paragraph: paragraph.trim(),
        encounter_id: encounterId || null,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const raw = await res.text();
      let err = raw || "Clinical report failed";
      try {
        const j = JSON.parse(raw);
        if (typeof j.detail === "string") err = j.detail;
      } catch {
        // use raw
      }
      throw new Error(err);
    }
    return res.json();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Request timed out. The model may still be running; check the dashboard in a minute.");
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function summarizeTranscriptKeywords(
  transcript: string,
  maxKeywords = 40
): Promise<{ ok: boolean; keywords: string[]; keyword_text: string }> {
  const res = await fetch(`${BASE}/api/clinical-report/keywords`, {
    method: "POST",
    credentials: CREDS,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript: transcript.trim(), max_keywords: maxKeywords }),
  });
  if (!res.ok) throw new Error(await authError(res));
  return res.json();
}

export async function assessVisionScreenshot(
  imageBase64: string
): Promise<{
  ok: boolean;
  summary: string;
  severity: string;
  keywords: string[];
  metrics: {
    redness_pct: number;
    brightness: number;
    edge_density_pct: number;
    laplacian_variance: number;
  };
}> {
  const res = await fetch(`${BASE}/api/vision/screenshot-assess`, {
    method: "POST",
    credentials: CREDS,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });
  if (!res.ok) throw new Error(await authError(res));
  return res.json();
}

export async function summarizeFinalCondensed(
  transcript: string,
  visionNotes: string[],
  maxKeywords = 30
): Promise<{ ok: boolean; summary: string; keywords: string[]; keyword_text: string }> {
  const res = await fetch(`${BASE}/api/clinical-report/final-condensed`, {
    method: "POST",
    credentials: CREDS,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: transcript.trim(),
      vision_notes: visionNotes,
      max_keywords: maxKeywords,
    }),
  });
  if (!res.ok) throw new Error(await authError(res));
  return res.json();
}

export async function getAgentReport(encounterId: string): Promise<{ ok: boolean; report: AgentReport | null }> {
  const res = await fetch(`${BASE}/api/encounters/${encounterId}/agent-report`, { credentials: CREDS });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

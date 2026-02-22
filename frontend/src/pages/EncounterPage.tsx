import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AmbientSidebar,
  LiveTranscription,
  PrivacyToggle,
  HardwareStatusBar,
  ProcessingOverlay,
  type TranscriptSegment,
} from "@/components/encounter";
import {
  assessVisionScreenshot,
  createEncounter,
  endEncounter,
  getDeviceMonitorWsUrl,
  runClinicalReportStream,
  sendDeviceCommand,
  summarizeFinalCondensed,
} from "@/api/client";
import { getMockHardwareParagraphs } from "@/utils/mockHardwareParagraphs";

type HwStatus = "idle" | "connecting" | "receiving" | "received" | "error";
type VitalsSource = "simulated" | "hrv_sensor";

/** Simulate hardware delay before "data received" (ms). */
const HARDWARE_SIMULATE_DELAY_MS = 4000;
const FINAL_TRANSCRIPT_WAIT_MS = 12000;
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "have", "has", "had", "were", "was", "are", "been",
  "into", "about", "when", "then", "than", "they", "them", "their", "there", "your", "you", "our", "his",
  "her", "its", "can", "could", "would", "should", "will", "just", "very", "also", "patient", "states",
  "state", "reports", "report", "said", "says", "today",
]);

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

type VisionAssessment = {
  summary: string;
  severity: string;
  keywords: string[];
  metrics: {
    redness_pct: number;
    brightness: number;
    edge_density_pct: number;
    laplacian_variance: number;
  };
};

function extractKeywordTerms(text: string, incoming: string[] = []): string[] {
  const merged = [...incoming];
  const words = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const inferred = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
  return [...new Set([...merged, ...inferred])].slice(0, 10);
}

export function EncounterPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [paused, setPaused] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const [visionLog, setVisionLog] = useState<string[]>([]);
  const [ending, setEnding] = useState(false);
  const [hwMic, setHwMic] = useState<HwStatus>("idle");
  const [hwHeart, setHwHeart] = useState<HwStatus>("idle");
  const [hwCamera, setHwCamera] = useState<HwStatus>("idle");
  const [dataReceived, setDataReceived] = useState(false);
  const [paragraph1, setParagraph1] = useState("");
  const [paragraph2, setParagraph2] = useState("");
  const [vitalsSource, setVitalsSource] = useState<VitalsSource>("hrv_sensor");
  const [latestHrv, setLatestHrv] = useState<{
    heart_rate?: number;
    spo2?: number;
    hrv?: number;
    rmssd?: number;
    sdnn?: number;
    pnn50?: number;
    text?: string;
  } | null>(null);
  const [runningDiagnosis, setRunningDiagnosis] = useState(false);
  const [runError, setRunError] = useState("");
  const [liveStatus, setLiveStatus] = useState("");
  const [capturingImage, setCapturingImage] = useState(false);
  const [visionAssessment, setVisionAssessment] = useState<VisionAssessment | null>(null);
  const [finalCondensedSummary, setFinalCondensedSummary] = useState("");
  const [finalMedicalKeywords, setFinalMedicalKeywords] = useState<string[]>([]);
  const deviceWsRef = useRef<WebSocket | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const speechRef = useRef<BrowserSpeechRecognition | null>(null);
  const captureActiveRef = useRef(false);

  const listenStatus = paused ? "paused" : encounterId ? "listening" : "idle";

  const startEncounter = useCallback(async () => {
    if (!patientId) return;
    try {
      const { encounter_id } = await createEncounter(patientId);
      setEncounterId(encounter_id);
      setFinalCondensedSummary("");
      setFinalMedicalKeywords([]);
      setVisionAssessment(null);
      setVisionLog([]);
      setHwMic("connecting");
      setHwHeart("connecting");
      setHwCamera("connecting");
    } catch (e) {
      console.error("Failed to start encounter", e);
    }
  }, [patientId]);

  useEffect(() => {
    startEncounter();
    return () => {
      try {
        speechRef.current?.stop();
      } catch {
        // ignore
      }
      speechRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
      deviceWsRef.current?.close();
      deviceWsRef.current = null;
    };
  }, [startEncounter]);

  // Simulate hardware sending data after delay (placeholder until real hardware).
  useEffect(() => {
    if (vitalsSource !== "simulated") return;
    if (!encounterId || hwMic !== "connecting") return;
    const t1 = setTimeout(() => {
      setHwMic("receiving");
      setHwHeart("receiving");
      setHwCamera("receiving");
    }, 800);
    const t2 = setTimeout(() => {
      setHwMic("received");
      setHwHeart("received");
      setHwCamera("received");
      const mock = getMockHardwareParagraphs();
      setParagraph1(mock.paragraph1);
      setParagraph2(mock.paragraph2);
      setDataReceived(true);
    }, HARDWARE_SIMULATE_DELAY_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [encounterId, hwMic, vitalsSource]);

  // Browser camera + microphone capture for encounter transcript (no external mic stream).
  useEffect(() => {
    if (!encounterId || !sessionActive || captureActiveRef.current) return;
    let cancelled = false;

    const startCapture = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;
        captureActiveRef.current = true;
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
          void previewVideoRef.current.play().catch(() => {
            // autoplay may be blocked; capture still works after user interaction
          });
        }
        setHwMic("receiving");
        setHwCamera("receiving");

        const Ctor =
          (window as unknown as { SpeechRecognition?: BrowserSpeechRecognitionCtor; webkitSpeechRecognition?: BrowserSpeechRecognitionCtor }).SpeechRecognition ||
          (window as unknown as { SpeechRecognition?: BrowserSpeechRecognitionCtor; webkitSpeechRecognition?: BrowserSpeechRecognitionCtor }).webkitSpeechRecognition;
        if (!Ctor) {
          setHwMic("error");
          return;
        }
        const rec = new Ctor();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = "en-US";
        rec.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const row = event.results[i];
            const isFinal = Boolean(row?.isFinal);
            const chunk = String(row?.[0]?.transcript || "").trim();
            if (!chunk || !isFinal) continue;
            finalTranscriptRef.current = `${finalTranscriptRef.current} ${chunk}`.trim();
            const keyTerms = extractKeywordTerms(chunk);
            setSegments((prev) => [...prev, { text: `${chunk}. `, key_terms: keyTerms }]);
            setDataReceived(true);
            setHwMic("received");
            setHwCamera("received");
          }
        };
        rec.onerror = () => {
          setHwMic("error");
        };
        rec.onend = () => {
          if (!cancelled && !paused && sessionActive) {
            try {
              rec.start();
            } catch {
              // ignore restart errors
            }
          }
        };
        speechRef.current = rec;
        rec.start();
      } catch {
        setHwMic("error");
        setHwCamera("error");
      }
    };

    void startCapture();
    return () => {
      cancelled = true;
    };
  }, [encounterId, sessionActive]);

  useEffect(() => {
    const rec = speechRef.current;
    if (!rec) return;
    try {
      if (paused || !sessionActive) {
        rec.stop();
      } else {
        rec.start();
      }
    } catch {
      // ignore duplicate start/stop errors
    }
  }, [paused, sessionActive]);

  // HRV sensor monitor stream from backend websocket (fed by Raspberry Pi).
  useEffect(() => {
    if (!encounterId || vitalsSource !== "hrv_sensor") return;
    const url = getDeviceMonitorWsUrl(encounterId);
    const ws = new WebSocket(url);
    deviceWsRef.current = ws;
    setHwHeart("connecting");
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const vitals = data.latest_vitals ?? data;
        if (data?.type === "final" && typeof data.transcript === "string" && data.transcript.trim()) {
          const transcript = data.transcript.trim();
          setParagraph2(transcript);
          finalTranscriptRef.current = transcript;
          const keyTerms = extractKeywordTerms(transcript);
          setSegments((prev) => [
            ...prev,
            { text: transcript, key_terms: keyTerms },
          ]);
          setDataReceived(true);
          return;
        }
        if (data?.type === "hrv_complete" && data?.hrv && typeof data.hrv === "object") {
          const hrv = data.hrv as Record<string, unknown>;
          setLatestHrv({
            heart_rate: Number(hrv.bpm),
            spo2: Number(hrv.spo2),
            hrv: hrv.hrv != null ? Number(hrv.hrv) : undefined,
            rmssd: hrv.rmssd != null ? Number(hrv.rmssd) : undefined,
            sdnn: hrv.sdnn != null ? Number(hrv.sdnn) : undefined,
            pnn50: hrv.pnn50 != null ? Number(hrv.pnn50) : undefined,
          });
          setDataReceived(true);
          return;
        }
        if (vitals?.type === "vitals" || vitals?.heart_rate != null || vitals?.hr != null) {
          setLatestHrv({
            heart_rate: Number(vitals.heart_rate ?? vitals.hr ?? vitals.bpm),
            spo2: Number(vitals.spo2 ?? vitals.oxy ?? vitals.oxygen_sat),
            hrv: vitals.hrv != null ? Number(vitals.hrv) : undefined,
            rmssd: vitals.rmssd != null ? Number(vitals.rmssd) : undefined,
            sdnn: vitals.sdnn != null ? Number(vitals.sdnn) : undefined,
            pnn50: vitals.pnn50 != null ? Number(vitals.pnn50) : undefined,
            text: typeof vitals.text === "string" ? vitals.text : undefined,
          });
          setHwHeart("received");
          setDataReceived(true);
          const hrTxt = vitals.heart_rate ?? vitals.hr ?? vitals.bpm;
          const spo2Txt = vitals.spo2 ?? vitals.oxy ?? vitals.oxygen_sat;
          const hrvTxt = vitals.hrv ?? vitals.rmssd;
          setParagraph1(`Sensor vitals: heart rate ${hrTxt ?? "unknown"} bpm, SpO2 ${spo2Txt ?? "unknown"}%, HRV ${hrvTxt ?? "unknown"}.`);
          if (typeof vitals.text === "string" && vitals.text.trim()) {
            setParagraph2(vitals.text.trim());
          }
        }
      } catch {
        // ignore malformed monitor payloads
      }
    };
    ws.onopen = () => {
      setHwHeart("receiving");
      void sendDeviceCommand("start").catch(() => {
        setHwHeart("error");
      });
    };
    ws.onerror = () => {
      setHwHeart("error");
    };
    ws.onclose = () => {
      if (deviceWsRef.current === ws) deviceWsRef.current = null;
    };
    return () => {
      ws.close();
      if (deviceWsRef.current === ws) deviceWsRef.current = null;
    };
  }, [encounterId, vitalsSource]);

  const handleCaptureScreenshot = useCallback(async () => {
    const video = previewVideoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setRunError("Camera preview is not ready yet");
      return;
    }
    setCapturingImage(true);
    setRunError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const jpeg = canvas.toDataURL("image/jpeg", 0.88);
      const result = await assessVisionScreenshot(jpeg);
      setVisionAssessment(result);
      const line = `${result.summary}; tags: ${result.keywords.slice(0, 10).join(", ")}`;
      setVisionLog((prev) => [line, ...prev].slice(0, 20));
      setParagraph2((prev) => [prev, line].filter(Boolean).join("\n"));
      setDataReceived(true);
      setHwCamera("received");
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Screenshot assessment failed");
    } finally {
      setCapturingImage(false);
    }
  }, []);

  // End encounter: always run triage model (with Lottie overlay), then end and go to dashboard
  const handleEndEncounter = useCallback(async () => {
    if (!encounterId) return;
    setEnding(true);
    setRunningDiagnosis(true);
    setSessionActive(false);
    setRunError("");
    setLiveStatus("Starting clinical agents…");
    try {
      speechRef.current?.stop();
    } catch {
      // ignore
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
    captureActiveRef.current = false;
    if (vitalsSource === "hrv_sensor") {
      setLiveStatus("Stopping hardware recording…");
      try {
        await sendDeviceCommand("stop");
      } catch {
        // continue even if stop command cannot be delivered
      }
      const start = Date.now();
      while (!finalTranscriptRef.current && Date.now() - start < FINAL_TRANSCRIPT_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    const localTranscript = finalTranscriptRef.current.trim();
    const combined =
      paragraph1.trim() || paragraph2.trim()
        ? [paragraph1.trim(), paragraph2.trim()].filter(Boolean).join("\n\n")
        : [localTranscript, segments.map((s) => s.text).filter(Boolean).join(" ")].filter(Boolean).join(" ");
    const sensorSummary =
      vitalsSource === "hrv_sensor" && latestHrv
        ? [
            `Sensor source: HRV sensor.`,
            latestHrv.heart_rate != null ? `Heart rate: ${latestHrv.heart_rate} bpm.` : "",
            latestHrv.spo2 != null ? `SpO2: ${latestHrv.spo2}%.` : "",
            latestHrv.hrv != null ? `HRV: ${latestHrv.hrv}.` : "",
            latestHrv.rmssd != null ? `RMSSD: ${latestHrv.rmssd}.` : "",
            latestHrv.sdnn != null ? `SDNN: ${latestHrv.sdnn}.` : "",
            latestHrv.pnn50 != null ? `pNN50: ${latestHrv.pnn50}.` : "",
          ]
            .filter(Boolean)
            .join(" ")
        : "";
    // Always run the model: use fallback so agents run even if no hardware/transcript yet
    const visionSummary = visionLog.join("\n");
    const sourceForKeywords =
      [combined.trim(), sensorSummary, visionSummary].filter(Boolean).join("\n\n").trim() ||
      (() => {
        const mock = getMockHardwareParagraphs();
        return [mock.paragraph1, mock.paragraph2].filter(Boolean).join("\n\n");
      })();
    setLiveStatus("Generating final condensed medical summary…");
    let keywordsText = "";
    let condensedSummary = "";
    try {
      const finalResp = await summarizeFinalCondensed(sourceForKeywords, visionLog, 36);
      condensedSummary = (finalResp.summary || "").trim();
      keywordsText = (finalResp.keyword_text || "").trim();
      setFinalCondensedSummary(condensedSummary);
      setFinalMedicalKeywords(finalResp.keywords || []);
    } catch {
      keywordsText = segments
        .flatMap((s) => s.key_terms ?? [])
        .slice(0, 48)
        .join(", ");
      condensedSummary = keywordsText;
      setFinalCondensedSummary(condensedSummary);
      setFinalMedicalKeywords(
        keywordsText
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean)
          .slice(0, 36)
      );
    }
    let textForModel = [condensedSummary, keywordsText, sensorSummary].filter(Boolean).join("\n");
    if (!textForModel.trim()) {
      textForModel = sourceForKeywords;
    }
    const transcriptPayload =
      localTranscript
        ? [
            { text: localTranscript, key_terms: extractKeywordTerms(localTranscript) },
          ]
        : paragraph1 || paragraph2
        ? [{ text: paragraph1, key_terms: extractKeywordTerms(paragraph1) }, { text: paragraph2, key_terms: extractKeywordTerms(paragraph2) }]
        : segments.map((s) => ({ text: s.text, key_terms: extractKeywordTerms(s.text, s.key_terms ?? []) }));

    try {
      await runClinicalReportStream(textForModel, encounterId, (message) => setLiveStatus(message));
      await endEncounter(encounterId, {
        transcript: transcriptPayload,
        vision_log: visionLog,
      });
      setSessionActive(false);
      navigate(`/encounter/${encounterId}/journey`);
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Failed to process or end encounter";
      setRunError(message);
      setEnding(false);
      setRunningDiagnosis(false);
      setSessionActive(true);
    }
  }, [encounterId, paragraph1, paragraph2, segments, visionLog, navigate, vitalsSource, latestHrv]);

  if (!patientId) {
    return (
      <div className="p-6 text-clinical-muted">
        No patient selected. <Link to="/patients" className="text-clinical-primary hover:underline">Back to patients</Link>.
      </div>
    );
  }

  const processing = ending || runningDiagnosis;

  return (
    <div className="flex flex-1 min-h-0 relative">
      {processing && (
        <ProcessingOverlay
          message={liveStatus || "Running clinical agents…"}
          submessage="Don’t close this page."
          live
        />
      )}
      <AmbientSidebar
        listenStatus={listenStatus}
        visionLog={visionLog}
        sessionActive={sessionActive}
      />
      <div className="flex-1 flex flex-col min-w-0 p-6">
        {runError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-medium">Model or encounter error</p>
            <p className="mt-1">{runError.length > 300 ? runError.slice(0, 300) + "…" : runError}</p>
            <p className="mt-2 text-xs text-red-600">
              Verify Ollama is running and mistral is installed, then retry.
            </p>
          </div>
        )}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Active encounter</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-clinical-border bg-white px-3 py-1.5 text-xs">
              <span className="text-clinical-muted">Vitals source</span>
              <button
                type="button"
                onClick={() => setVitalsSource("simulated")}
                className={`rounded px-2 py-1 ${vitalsSource === "simulated" ? "bg-clinical-primary text-white" : "bg-gray-100 text-gray-700"}`}
              >
                Simulated
              </button>
              <button
                type="button"
                onClick={() => setVitalsSource("hrv_sensor")}
                className={`rounded px-2 py-1 ${vitalsSource === "hrv_sensor" ? "bg-clinical-primary text-white" : "bg-gray-100 text-gray-700"}`}
              >
                HRV sensor
              </button>
            </div>
            <PrivacyToggle paused={paused} onToggle={() => setPaused((p) => !p)} />
            <button
              type="button"
              onClick={handleEndEncounter}
              disabled={processing || !encounterId}
              className="rounded-lg bg-clinical-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-clinical-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? "Running agents…" : "End encounter"}
            </button>
          </div>
        </div>

        <HardwareStatusBar
          microphone={hwMic}
          heartSensor={hwHeart}
          camera={hwCamera}
          className="mb-4"
        />
        <div className="flex flex-1 min-h-0 gap-4">
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            {dataReceived && (
              <div className="rounded-xl border border-clinical-border bg-clinical-surface p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Encounter summary (camera + microphone)</h3>
                <div className="space-y-3 text-sm text-gray-700">
                  <div>
                    <span className="text-xs font-medium text-clinical-muted block mb-1">Vitals / findings</span>
                    <p className="whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{paragraph1 || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-clinical-muted block mb-1">Visual / context</span>
                    <p className="whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{paragraph2 || "—"}</p>
                  </div>
                </div>
                {vitalsSource === "hrv_sensor" && latestHrv && (
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="rounded border border-gray-200 bg-white px-2 py-1">HR: {latestHrv.heart_rate ?? "—"} bpm</div>
                    <div className="rounded border border-gray-200 bg-white px-2 py-1">SpO₂: {latestHrv.spo2 ?? "—"}%</div>
                    <div className="rounded border border-gray-200 bg-white px-2 py-1">HRV: {latestHrv.hrv ?? latestHrv.rmssd ?? "—"}</div>
                    <div className="rounded border border-gray-200 bg-white px-2 py-1">SDNN: {latestHrv.sdnn ?? "—"}</div>
                  </div>
                )}
              </div>
            )}
            <LiveTranscription segments={segments} paused={paused} className="flex-1 min-h-0" />
          </div>

          <aside className="w-[360px] shrink-0 rounded-xl border border-clinical-border bg-white p-3 flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-clinical-muted">Live Camera Panel</div>
            <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-black">
              <video ref={previewVideoRef} autoPlay muted playsInline className="h-[220px] w-full object-cover" />
              {capturingImage && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                  <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-900 animate-pulse">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                    Running wound analysis…
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleCaptureScreenshot}
              disabled={processing || paused || capturingImage}
              className="rounded-lg border border-clinical-border bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {capturingImage ? "Analyzing screenshot…" : "Capture wound screenshot"}
            </button>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-700 mb-1">Latest image prediction</div>
              {visionAssessment ? (
                <>
                  <p className="text-xs text-gray-700">{visionAssessment.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {visionAssessment.keywords.slice(0, 12).map((k) => (
                      <span key={k} className="rounded-full border border-red-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-800">
                        {k}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-clinical-muted">No screenshot analyzed yet.</p>
              )}
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-700 mb-1">Final condensed clinical paragraph</div>
              <p className="text-xs text-gray-800 whitespace-pre-wrap">{finalCondensedSummary || "Generated on End encounter."}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-700 mb-1">Medical key words</div>
              <div className="flex flex-wrap gap-1">
                {finalMedicalKeywords.length > 0 ? finalMedicalKeywords.map((k) => (
                  <span key={k} className="rounded-full border border-red-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-800">
                    {k}
                  </span>
                )) : <span className="text-xs text-clinical-muted">Generated on End encounter.</span>}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

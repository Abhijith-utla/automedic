import { useEffect, useState } from "react";
import Lottie from "lottie-react";

interface ProcessingOverlayProps {
  message?: string;
  submessage?: string;
  /** When true, show only message (live updates). When false, rotate through default steps. */
  live?: boolean;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Full-screen overlay with Doctor & Patient Lottie while AI is processing. */
export function ProcessingOverlay({
  message: messageProp,
  submessage: submessageProp = "Please don’t close this page.",
  live = false,
}: ProcessingOverlayProps) {
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/lottie-doctor-patient.json")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch(() => {
        if (!cancelled) setAnimationData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const message = live ? (messageProp || "Running…") : (messageProp || "Running clinical agents…");

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm">
      <div className="flex flex-col items-center justify-center max-w-md px-6 text-center">
        <div className="w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
          {animationData ? (
            <Lottie
              animationData={animationData}
              loop
              className="w-full h-full"
            />
          ) : (
            <div className="w-16 h-16 rounded-full border-4 border-clinical-primary border-t-transparent animate-spin" />
          )}
        </div>
        <h2 className="mt-6 text-xl font-semibold text-gray-900">{message}</h2>
        <p className="mt-2 text-sm text-clinical-muted">{submessageProp}</p>
        <p className="mt-4 text-sm font-medium text-clinical-muted tabular-nums">
          Elapsed: {formatElapsed(elapsed)}
        </p>
      </div>
    </div>
  );
}

type Status = "idle" | "connecting" | "receiving" | "received" | "error";

interface HardwareStatusBarProps {
  microphone: Status;
  heartSensor: Status;
  camera: Status;
  className?: string;
}

const LABELS: Record<Status, string> = {
  idle: "Waiting",
  connecting: "Connecting…",
  receiving: "Receiving…",
  received: "Received",
  error: "Error",
};

function StatusPill({ status, label }: { status: Status; label: string }) {
  const text = LABELS[status];
  const color =
    status === "received"
      ? "bg-emerald-100 text-emerald-800"
      : status === "error"
        ? "bg-red-100 text-red-800"
        : "bg-amber-50 text-amber-800";
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>{text}</span>
    </div>
  );
}

export function HardwareStatusBar({ microphone, heartSensor, camera, className = "" }: HardwareStatusBarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-6 rounded-xl border border-clinical-border bg-clinical-surface px-4 py-3 ${className}`}>
      <span className="text-xs font-semibold text-clinical-muted uppercase tracking-wide">Hardware</span>
      <StatusPill status={microphone} label="Microphone" />
      <StatusPill status={heartSensor} label="Heart sensor" />
      <StatusPill status={camera} label="Camera" />
    </div>
  );
}

/**
 * Audio visualizer: pulse/wave to show "system listening."
 * States: idle | listening | paused
 */

type Status = "idle" | "listening" | "paused";

interface AudioVisualizerProps {
  status: Status;
  className?: string;
}

export function AudioVisualizer({ status, className = "" }: AudioVisualizerProps) {
  const isActive = status === "listening";
  const isPaused = status === "paused";

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      title={isPaused ? "Paused" : isActive ? "Listening" : "Idle"}
      aria-label={isPaused ? "Paused" : isActive ? "Listening" : "Idle"}
    >
      <div className="flex items-end gap-0.5 h-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-300 ${
              isPaused
                ? "bg-clinical-muted/40"
                : isActive
                  ? "bg-clinical-primary animate-pulse"
                  : "bg-clinical-muted/30"
            }`}
            style={{
              height: isActive ? `${12 + (i % 3) * 4}px` : "6px",
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
      <span className="text-xs text-clinical-muted">
        {isPaused ? "Paused" : isActive ? "Live" : "—"}
      </span>
    </div>
  );
}

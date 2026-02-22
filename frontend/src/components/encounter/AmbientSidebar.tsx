/**
 * Ambient sidebar: audio visualizer, vision activity log, session status.
 */

import { AudioVisualizer } from "./AudioVisualizer";

type ListenStatus = "idle" | "listening" | "paused";

interface AmbientSidebarProps {
  listenStatus: ListenStatus;
  visionLog: string[];
  sessionActive: boolean;
  className?: string;
}

export function AmbientSidebar({
  listenStatus,
  visionLog,
  sessionActive,
  className = "",
}: AmbientSidebarProps) {
  return (
    <aside
      className={`w-56 shrink-0 border-r border-clinical-border bg-clinical-surface flex flex-col ${className}`}
    >
      <div className="p-3 border-b border-clinical-border">
        <div className="text-xs font-medium text-clinical-muted mb-2">Live input</div>
        <AudioVisualizer status={listenStatus} />
      </div>
      <div className="p-3 border-b border-clinical-border">
        <div className="text-xs font-medium text-clinical-muted mb-2">Vision</div>
        <div className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto scroll-thin">
          {visionLog.length === 0 ? (
            <span className="text-clinical-muted">No observations yet</span>
          ) : (
            visionLog.map((line, i) => (
              <div key={i} className="leading-tight">
                {line}
              </div>
            ))
          )}
        </div>
      </div>
      <div className="p-3 mt-auto">
        <div
          className={`inline-flex items-center gap-2 rounded px-2 py-1 text-xs font-medium ${
            sessionActive ? "bg-emerald-50 text-emerald-700" : "bg-clinical-border/50 text-clinical-muted"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${sessionActive ? "bg-emerald-500" : "bg-clinical-muted"}`}
          />
          {sessionActive ? "Session active" : "Session ended"}
        </div>
      </div>
    </aside>
  );
}

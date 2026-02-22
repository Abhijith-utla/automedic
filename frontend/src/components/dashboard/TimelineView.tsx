/**
 * Patient history timeline from EMR (mock).
 */

import type { TimelineEntry } from "@/api/client";

interface TimelineViewProps {
  entries: TimelineEntry[];
  className?: string;
}

export function TimelineView({ entries, className = "" }: TimelineViewProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      <h3 className="text-xs font-semibold text-clinical-muted mb-2">Patient history</h3>
      <ul className="space-y-2">
        {entries.length === 0 ? (
          <li className="text-xs text-clinical-muted">No history loaded</li>
        ) : (
          entries.map((e) => (
            <li
              key={e.id}
              className="flex gap-2 text-xs border-l-2 border-clinical-border pl-2 py-1"
            >
              <span className="text-clinical-muted shrink-0">{e.date}</span>
              <span className="text-gray-700">{e.summary}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

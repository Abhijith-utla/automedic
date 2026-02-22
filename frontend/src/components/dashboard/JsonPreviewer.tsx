/**
 * Developer view: show speech → structured data (transcript + entities, ICD-10).
 */

import { useState } from "react";

interface JsonPreviewerProps {
  data: object;
  label?: string;
  defaultOpen?: boolean;
  className?: string;
}

export function JsonPreviewer({
  data,
  label = "Structured data",
  defaultOpen = false,
  className = "",
}: JsonPreviewerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const json = JSON.stringify(data, null, 2);

  return (
    <div className={`rounded-lg border border-clinical-border bg-gray-50 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-medium text-clinical-muted hover:bg-gray-100 rounded-t-lg"
      >
        {label}
        <span className="tabular-nums">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <pre className="p-3 text-xs overflow-x-auto overflow-y-auto max-h-64 scroll-thin text-gray-700 border-t border-clinical-border">
          {json}
        </pre>
      )}
    </div>
  );
}

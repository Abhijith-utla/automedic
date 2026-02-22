/**
 * Out-of-the-box insights: DDx alerts, evidence links, drug interaction flags.
 * Color: red = critical, blue = informational.
 */

interface InsightsPanelProps {
  ddxAlerts: string[];
  evidenceLinks: { title: string; url: string }[];
  drugFlags: { drug: string; message: string; severity: string }[];
  className?: string;
}

export function InsightsPanel({
  ddxAlerts,
  evidenceLinks,
  drugFlags,
  className = "",
}: InsightsPanelProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-900">Insights</h3>
      {ddxAlerts.length > 0 && (
        <div>
          <div className="text-xs font-medium text-clinical-muted mb-2">Differential (DDx)</div>
          <ul className="space-y-2">
            {ddxAlerts.map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-lg border border-clinical-info/30 bg-clinical-infoBg p-3 text-sm text-clinical-info"
              >
                <span className="shrink-0">💡</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {evidenceLinks.length > 0 && (
        <div>
          <div className="text-xs font-medium text-clinical-muted mb-2">Evidence</div>
          <ul className="space-y-1">
            {evidenceLinks.map((l, i) => (
              <li key={i}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-clinical-primary hover:underline"
                >
                  {l.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {drugFlags.length > 0 && (
        <div>
          <div className="text-xs font-medium text-clinical-muted mb-2">Drug check</div>
          <ul className="space-y-2">
            {drugFlags.map((f, i) => (
              <li
                key={i}
                className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                  f.severity === "high"
                    ? "border-red-200 bg-clinical-dangerBg text-clinical-danger"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <span className="shrink-0">⚠</span>
                <span>
                  <strong>{f.drug}</strong>: {f.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Visual bar for AI confidence (0–1 or 0–100).
 */

interface ConfidenceGaugeProps {
  value: number; // 0–1
  label?: string;
  showPercent?: boolean;
  className?: string;
}

export function ConfidenceGauge({
  value,
  label,
  showPercent = true,
  className = "",
}: ConfidenceGaugeProps) {
  const pct = value <= 1 ? Math.round(value * 100) : Math.round(value);
  const width = Math.min(100, pct);
  const barColor =
    width >= 70 ? "bg-red-500" : width >= 40 ? "bg-amber-500" : "bg-clinical-muted";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 min-w-0 h-2 rounded-full bg-clinical-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${width}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showPercent && (
        <span className="text-xs font-medium text-clinical-muted tabular-nums w-8">
          {pct}%
        </span>
      )}
      {label && <span className="text-xs text-clinical-muted">{label}</span>}
    </div>
  );
}

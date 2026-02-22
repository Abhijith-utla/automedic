/**
 * Alerts from latest encounter (conflicts, drug interactions).
 */

interface AlertsCardProps {
  alerts: string[];
  className?: string;
}

export function AlertsCard({ alerts, className = "" }: AlertsCardProps) {
  if (alerts.length === 0) return null;

  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50/80 p-4 ${className}`}>
      <div className="text-xs font-medium text-amber-800 mb-2">Alerts</div>
      <ul className="space-y-1.5 text-sm text-amber-900">
        {alerts.map((a, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0 text-amber-600">⚠</span>
            <span>{a}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Simple bar chart: encounters per month for progress view.
 */

interface EncountersByMonthChartProps {
  monthCounts: { month: string; count: number }[];
  className?: string;
}

function formatMonth(key: string): string {
  const [y, m] = key.split("-");
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  const i = parseInt(m, 10) - 1;
  return i >= 0 && i < 12 ? `${months[i]} ${y}` : key;
}

export function EncountersByMonthChart({ monthCounts, className = "" }: EncountersByMonthChartProps) {
  const max = Math.max(1, ...monthCounts.map((c) => c.count));

  return (
    <div className={className}>
      <div className="text-xs font-medium text-clinical-muted mb-2">Encounters by month</div>
      <div className="flex items-end gap-1 h-24">
        {monthCounts.map(({ month, count }) => (
          <div key={month} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-clinical-primary/80 min-h-[4px] transition-all"
              style={{ height: `${(count / max) * 80}%` }}
              title={`${formatMonth(month)}: ${count}`}
            />
            <span className="text-[10px] text-clinical-muted truncate max-w-full">
              {formatMonth(month).split(" ")[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

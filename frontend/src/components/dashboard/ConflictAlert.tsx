/**
 * Red conflict alert (e.g. allergy vs suggested med).
 */

interface ConflictAlertProps {
  message: string;
  className?: string;
}

export function ConflictAlert({ message, className = "" }: ConflictAlertProps) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-red-200 bg-clinical-dangerBg p-3 text-sm text-clinical-danger ${className}`}
      role="alert"
    >
      <span className="shrink-0" aria-hidden>
        ⚠
      </span>
      <span>{message}</span>
    </div>
  );
}

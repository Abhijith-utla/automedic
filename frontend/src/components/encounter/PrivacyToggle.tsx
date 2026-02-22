/**
 * Pause/Mute for sensitive parts of the conversation.
 * HIPAA transparency: clear Recording vs Paused state.
 */

interface PrivacyToggleProps {
  paused: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}

export function PrivacyToggle({
  paused,
  onToggle,
  disabled = false,
  className = "",
}: PrivacyToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition ${className} ${
        paused
          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
          : "bg-clinical-dangerBg text-clinical-danger hover:bg-red-100"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      title={paused ? "Resume recording" : "Pause recording (sensitive part)"}
      aria-pressed={paused}
    >
      {paused ? (
        <>
          <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden />
          Paused
        </>
      ) : (
        <>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden />
          Recording
        </>
      )}
    </button>
  );
}

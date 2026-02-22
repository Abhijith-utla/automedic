/**
 * After report is accepted: option to email or call the patient
 * about the report and next steps / future consultation.
 */

import { useState } from "react";

interface FollowUpModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (method: "email" | "call", note: string) => Promise<void>;
  onSuccess?: (message: string) => void;
  loading?: boolean;
}

export function FollowUpModal({ open, onClose, onSubmit, onSuccess, loading = false }: FollowUpModalProps) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (method: "email" | "call") => {
    setError("");
    setSubmitting(true);
    try {
      await onSubmit(method, note);
      const msg = method === "email" ? "Email sent to patient." : "Automated call initiated.";
      onSuccess?.(msg);
      setNote("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="follow-up-title"
    >
      <div className="bg-clinical-surface rounded-xl shadow-lg border border-clinical-border p-6 max-w-md w-full mx-4">
        <h3 id="follow-up-title" className="text-lg font-semibold text-gray-900 mb-2">
          Contact patient
        </h3>
        <p className="text-sm text-clinical-muted mb-4">
          A custom email with the diagnosis and analysis will be sent to the patient, or an automated call will explain the report and answer their questions.
        </p>
        {error && (
          <p className="mb-4 text-sm text-clinical-danger bg-clinical-dangerBg p-2 rounded" role="alert">
            {error}
          </p>
        )}
        <div className="mb-4">
          <label htmlFor="follow-up-note" className="block text-xs font-medium text-clinical-muted mb-1">
            Next steps / message (optional)
          </label>
          <textarea
            id="follow-up-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Schedule follow-up in 2 weeks, start medication as prescribed..."
            className="w-full rounded-lg border border-clinical-border px-3 py-2 text-sm min-h-[80px]"
            rows={3}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => handleSubmit("email")}
            disabled={loading || submitting}
            className="flex-1 rounded-lg bg-clinical-primary text-white py-2.5 text-sm font-medium hover:bg-clinical-primaryHover disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Email report to patient"}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("call")}
            disabled={loading || submitting}
            className="flex-1 rounded-lg border border-clinical-primary text-clinical-primary py-2.5 text-sm font-medium hover:bg-clinical-primary/5 disabled:opacity-50"
          >
            {submitting ? "Initiating…" : "Automated call to patient"}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full text-sm text-clinical-muted hover:text-gray-900"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

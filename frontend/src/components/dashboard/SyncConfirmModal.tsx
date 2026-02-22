/**
 * Confirmation modal before syncing to chart.
 */

interface SyncConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  syncing?: boolean;
}

export function SyncConfirmModal({
  open,
  onConfirm,
  onCancel,
  syncing = false,
}: SyncConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-title"
    >
      <div className="bg-clinical-surface rounded-xl shadow-lg border border-clinical-border p-6 max-w-md w-full mx-4">
        <h3 id="sync-title" className="text-lg font-semibold text-gray-900 mb-2">
          Sync to chart
        </h3>
        <p className="text-sm text-clinical-muted mb-4">
          Push structured data (vitals, codes, notes) to the EMR. You can still edit after sync.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={syncing}
            className="px-4 py-2 text-sm font-medium text-clinical-muted hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={syncing}
            className="px-4 py-2 text-sm font-medium bg-clinical-primary text-white rounded-lg hover:bg-clinical-primaryHover disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Confirm sync"}
          </button>
        </div>
      </div>
    </div>
  );
}

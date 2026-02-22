/**
 * AI-generated field with Accept/Edit. "AI proposes, human disposes."
 */

import { useState } from "react";

interface EditableFieldProps {
  value: string;
  label: string;
  onSave: (value: string) => void;
  multiline?: boolean;
  className?: string;
}

export function EditableField({
  value,
  label,
  onSave,
  multiline = false,
  className = "",
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  return (
    <div className={`group ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-clinical-muted">{label}</span>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-clinical-primary hover:underline opacity-0 group-hover:opacity-100 transition"
            title="Edit"
          >
            Edit
          </button>
        ) : null}
      </div>
      {editing ? (
        <>
          {multiline ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded border border-clinical-border p-2 text-sm min-h-[80px]"
              autoFocus
            />
          ) : (
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded border border-clinical-border px-2 py-1.5 text-sm"
              autoFocus
            />
          )}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleSave}
              className="text-xs font-medium text-clinical-primary hover:underline"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-clinical-muted hover:underline"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{value || "—"}</p>
      )}
    </div>
  );
}

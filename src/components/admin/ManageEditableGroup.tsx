"use client";

export function ManageEditableGroup({
  summary,
  editing,
  onEdit,
  onCancel,
  onSave,
  saveError,
  saving,
  disabled,
  editLabel = "Edit",
  children,
}: {
  summary: React.ReactNode;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  saveError: string | null;
  saving?: boolean;
  disabled?: boolean;
  editLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {!editing ? (
        <>
          <div className="text-sm text-navy">{summary}</div>
          {!disabled && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-baby-200 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-baby-50"
            >
              {editLabel}
            </button>
          )}
        </>
      ) : (
        <>
          {children}
          {saveError && (
            <p className="text-xs text-red-700" role="alert">
              {saveError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-lg border border-baby-200 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-baby-50"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

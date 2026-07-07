import React, { useEffect } from 'react';
import { useModalFocus } from '../ui/useModalFocus';

interface BulkDeleteModalProps {
  /** How many leads are about to be deleted. */
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirm dialog for the bulk "Delete" action — mirrors DeleteModal's dark
 * theme and focus contract (Esc closes, focus lands on the safe Cancel button
 * so Enter never deletes by accident).
 */
export const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({
  count,
  onCancel,
  onConfirm,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const cancelRef = useModalFocus<HTMLButtonElement>();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm motion-safe:animate-fade-in"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Delete ${count} leads`}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-apex-850 p-6 shadow-2xl shadow-black/60 motion-safe:animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-xl font-bold text-slate-100">
          Delete {count} lead{count === 1 ? '' : 's'}?
        </h2>
        <p className="mb-6 text-sm text-slate-400">
          This can&apos;t be undone.
        </p>

        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-500 shadow-lg shadow-red-950/50"
          >
            Delete {count} lead{count === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect } from 'react';
import { useModalFocus } from '../ui/useModalFocus';

interface DeleteModalProps {
  deleteModal: { id: string; co: string };
  setDeleteModal: (modal: { id: string; co: string } | null) => void;
  handleDeleteLead: (id: string) => void;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  deleteModal,
  setDeleteModal,
  handleDeleteLead,
}) => {
  // Esc closes the dialog — expected of any modal in a polished app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeleteModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setDeleteModal]);

  // Destructive dialog: focus lands on the SAFE action (Cancel), so Enter
  // never deletes by accident; focus returns to the trigger on close.
  const cancelRef = useModalFocus<HTMLButtonElement>();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm motion-safe:animate-fade-in"
      onClick={() => setDeleteModal(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Delete ${deleteModal.co}`}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-apex-850 p-6 shadow-2xl shadow-black/60 motion-safe:animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-xl font-bold text-slate-100">Delete Lead</h2>
        <p className="mb-6 text-sm text-slate-400">
          Are you sure you want to delete the lead for <span className="font-bold text-slate-200">{deleteModal.co}</span>? This action cannot be undone.
        </p>

        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={() => setDeleteModal(null)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={() => handleDeleteLead(deleteModal.id)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-500 shadow-lg shadow-red-950/50"
          >
            Delete Lead
          </button>
        </div>
      </div>
    </div>
  );
};

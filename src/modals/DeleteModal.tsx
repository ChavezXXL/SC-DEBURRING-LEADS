import React, { useEffect } from 'react';

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={() => setDeleteModal(null)}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-xl font-bold text-slate-900">Delete Lead</h2>
        <p className="mb-6 text-sm text-slate-500">
          Are you sure you want to delete the lead for <span className="font-bold text-slate-800">{deleteModal.co}</span>? This action cannot be undone.
        </p>
        
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteModal(null)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={() => handleDeleteLead(deleteModal.id)}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-600 shadow-lg shadow-red-500/20"
          >
            Delete Lead
          </button>
        </div>
      </div>
    </div>
  );
};

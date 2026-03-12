import React from 'react';
import { X } from 'lucide-react';
import type { Lead } from '../types';
import { REGIONS } from '../data';

interface AddLeadModalProps {
  newLeadForm: Partial<Lead>;
  setNewLeadForm: React.Dispatch<React.SetStateAction<Partial<Lead>>>;
  setShowAddLead: (show: boolean) => void;
  handleAddLead: () => void;
}

export const AddLeadModal: React.FC<AddLeadModalProps> = ({
  newLeadForm,
  setNewLeadForm,
  setShowAddLead,
  handleAddLead,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={() => setShowAddLead(false)}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-1 text-lg font-bold text-zinc-100">Add New Lead</div>
            <div className="text-xs font-mono text-zinc-500">
              Manually enter a new company into the database.
            </div>
          </div>

          <button onClick={() => setShowAddLead(false)} className="text-zinc-500 transition-colors hover:text-zinc-300">
            <X size={24} />
          </button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Company Name *
            </label>
            <input
              value={newLeadForm.co ?? ''}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, co: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
              placeholder="Acme Aerospace"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
              City
            </label>
            <input
              value={newLeadForm.city ?? ''}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, city: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
              placeholder="Burbank"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Region
            </label>
            <select
              value={newLeadForm.r ?? 'Other'}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, r: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
            >
              {REGIONS
                .filter((r) => r !== 'All Regions')
                .map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
              General Contact
            </label>
            <input
              value={newLeadForm.who ?? ''}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, who: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Contact Role
            </label>
            <input
              value={newLeadForm.role ?? ''}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, role: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
              placeholder="Owner / GM"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Purchasing Manager
            </label>
            <input
              value={newLeadForm.pm ?? ''}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, pm: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
              placeholder="Jane Smith"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
              PM Title
            </label>
            <input
              value={newLeadForm.pm_title ?? ''}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, pm_title: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
              placeholder="Purchasing Manager"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Phone
            </label>
            <input
              value={newLeadForm.ph ?? ''}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, ph: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
              placeholder="(818) 555-1234"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Email
            </label>
            <input
              value={newLeadForm.em ?? ''}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, em: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
              placeholder="buyer@company.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Website
            </label>
            <input
              value={newLeadForm.web ?? ''}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, web: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
              placeholder="https://company.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Tier
            </label>
            <select
              value={newLeadForm.t ?? 2}
              onChange={(e) =>
                setNewLeadForm({ ...newLeadForm, t: Number(e.target.value) as 1 | 2 })
              }
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
            >
              <option value={1}>Tier 1 — Call Now</option>
              <option value={2}>Tier 2 — Target</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Parts / Industry
            </label>
            <input
              value={newLeadForm.parts ?? ''}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, parts: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
              placeholder="Aerospace components"
            />
          </div>

          <div className="col-span-2">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Pitch Angle
            </label>
            <input
              value={newLeadForm.pitch ?? ''}
              onChange={(e) => setNewLeadForm({ ...newLeadForm, pitch: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-orange-500/50 focus:outline-none"
              placeholder="Why do they need deburring?"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowAddLead(false)}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-zinc-400 transition-colors hover:text-zinc-200"
          >
            Cancel
          </button>

          <button
            onClick={handleAddLead}
            disabled={!newLeadForm.co?.trim()}
            className="rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          >
            Save Lead
          </button>
        </div>
      </div>
    </div>
  );
};

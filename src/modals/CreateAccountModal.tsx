import React, { useEffect, useState } from 'react';
import { Loader2, X, Check, AlertCircle, Copy } from 'lucide-react';
import { auth } from '../firebase';

interface CreateAccountModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Super-admin modal: spin up a new client account.
 * Calls /api/create-tenant-account (server-side) so creating an account
 * doesn't sign Santiago out of his own super-admin session.
 */
export function CreateAccountModal({ open, onClose }: CreateAccountModalProps) {
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setTenantName('');
    setTenantSlug('');
    setOwnerEmail('');
    setPassword(generatePassword());
    setError(null);
    setSuccess(null);
    setCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Esc closes the dialog (only while open).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleNameChange = (v: string) => {
    setTenantName(v);
    // Auto-derive slug from name if user hasn't customized it
    if (!tenantSlug || tenantSlug === slugify(tenantName)) {
      setTenantSlug(slugify(v));
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const user = auth.currentUser;
    if (!user) {
      setError('You need to be signed in to create accounts.');
      return;
    }
    if (!tenantName.trim() || !tenantSlug.trim() || !ownerEmail.trim() || !password.trim()) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      const idToken = await user.getIdToken();
      const resp = await fetch('/api/create-tenant-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          tenantId: tenantSlug.trim(),
          tenantName: tenantName.trim(),
          ownerEmail: ownerEmail.trim(),
          ownerPassword: password,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data?.error || `Request failed (${resp.status})`);
      } else {
        setSuccess(data?.message || 'Account created.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error');
    } finally {
      setBusy(false);
    }
  };

  const copyCredentials = async () => {
    const text = `URL: ${window.location.origin}\nEmail: ${ownerEmail}\nPassword: ${password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Create client account</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Spin up a new tenant. They get an empty CRM + welcome email.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-6 space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3">
              <Check size={20} className="text-emerald-600 mt-0.5 shrink-0" />
              <div className="text-sm text-emerald-800">{success}</div>
            </div>

            <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 text-sm space-y-1.5">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-medium mb-1">
                Login details (also emailed)
              </div>
              <div><span className="text-slate-500">URL:</span> <span className="text-slate-900 font-mono">{window.location.origin}</span></div>
              <div><span className="text-slate-500">Email:</span> <span className="text-slate-900 font-mono">{ownerEmail}</span></div>
              <div><span className="text-slate-500">Password:</span> <span className="text-slate-900 font-mono">{password}</span></div>
              <button
                onClick={copyCredentials}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
              >
                <Copy size={12} /> {copied ? 'Copied!' : 'Copy all'}
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  resetForm();
                }}
                className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition"
              >
                Create another
              </button>
              <button
                onClick={handleClose}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Business name
              </span>
              <input
                value={tenantName}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                placeholder="Acme Machine Shop"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Tenant slug (lowercase, unique)
              </span>
              <input
                value={tenantSlug}
                onChange={(e) => setTenantSlug(slugify(e.target.value))}
                required
                placeholder="acme-machine"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-mono text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              />
              <span className="mt-1 block text-[10px] text-slate-400">
                Used internally — they won't see it.
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Owner email
              </span>
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                required
                placeholder="owner@acmemachine.com"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Temp password
              </span>
              <div className="mt-1 flex gap-2">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword())}
                  className="rounded-xl bg-slate-100 px-3 text-xs font-medium text-slate-600 hover:bg-slate-200 transition"
                >
                  Generate
                </button>
              </div>
              <span className="mt-1 block text-[10px] text-slate-400">
                The owner gets this in their welcome email and can change it after signing in.
              </span>
            </label>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 ring-1 ring-red-200 px-3 py-2 text-xs text-red-700">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              {busy ? 'Creating account…' : 'Create account + send welcome email'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function generatePassword(length = 12): string {
  // Avoid 0/O, 1/l for readability
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pw = '';
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  for (let i = 0; i < length; i++) pw += chars[buf[i] % chars.length];
  return pw;
}

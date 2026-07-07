import React, { useEffect, useState } from 'react';
import { Loader2, X, Check, AlertCircle, Copy } from 'lucide-react';
import { auth } from '../firebase';
import { apiFetch, isNotConfigured, ApiError } from '../services/api';
import { ServerSetupCallout } from '../ui/ServerSetupCallout';
import { useModalFocus } from '../ui/useModalFocus';

interface CreateAccountModalProps {
  open: boolean;
  onClose: () => void;
  /** Fired once the tenant + owner are actually created (server confirmed).
   * Lets the parent refetch the list and toast. */
  onCreated?: (tenantName: string) => void;
}

type FieldKey = 'tenantName' | 'tenantSlug' | 'ownerEmail' | 'password';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Super-admin modal: spin up a new client account.
 * Calls /api/create-tenant-account (server-side) so creating an account
 * doesn't sign Santiago out of his own super-admin session.
 *
 * States it can show:
 *   - inline field validation (on blur + on submit, never browser alerts)
 *   - pending (spinner, double-submit locked)
 *   - success (confirmation panel: tenant + credentials, Done / Create another)
 *   - not-configured (friendly one-time-setup callout — never raw JSON garbage)
 *   - server error (clean message from the API)
 */
export function CreateAccountModal({ open, onClose, onCreated }: CreateAccountModalProps) {
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Focus the first field when the dialog opens; hand focus back to the
  // "New client account" button when it closes.
  const firstFieldRef = useModalFocus<HTMLInputElement>(open);

  const resetForm = () => {
    setTenantName('');
    setTenantSlug('');
    setOwnerEmail('');
    setPassword(generatePassword());
    setTouched({});
    setError(null);
    setNotConfigured(false);
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

  // ---- inline validation ---------------------------------------------------

  const fieldErrors: Partial<Record<FieldKey, string>> = {};
  if (!tenantName.trim()) fieldErrors.tenantName = 'Business name is required.';
  if (!tenantSlug.trim()) fieldErrors.tenantSlug = 'Slug is required — type a business name and it fills itself.';
  if (!ownerEmail.trim()) fieldErrors.ownerEmail = 'Owner email is required.';
  else if (!EMAIL_RE.test(ownerEmail.trim())) fieldErrors.ownerEmail = 'That doesn’t look like a valid email.';
  if (!password.trim()) fieldErrors.password = 'Password is required.';
  else if (password.length < 6) fieldErrors.password = 'Password needs at least 6 characters.';

  const showError = (k: FieldKey) => (touched[k] ? fieldErrors[k] : undefined);
  const markTouched = (k: FieldKey) => setTouched((t) => ({ ...t, [k]: true }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return; // double-submit lock
    setError(null);
    setNotConfigured(false);

    // Surface every field problem at once on a submit attempt, and put the
    // cursor in the first field that needs fixing.
    if (Object.keys(fieldErrors).length > 0) {
      setTouched({ tenantName: true, tenantSlug: true, ownerEmail: true, password: true });
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')
          ?.focus();
      });
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setError('You need to be signed in to create accounts.');
      return;
    }

    setBusy(true);
    try {
      const idToken = await user.getIdToken();
      const data = await apiFetch<{ message?: string }>('/api/create-tenant-account', {
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
      setSuccess(data?.message || `${tenantName.trim()} is live.`);
      // Tell the parent it can refetch the tenant list + toast. The success
      // panel (with credentials) stays open until the user dismisses it.
      onCreated?.(tenantName.trim());
    } catch (err: any) {
      if (isNotConfigured(err)) {
        setNotConfigured(true);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err?.message || 'Something went wrong. Try again.');
      }
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 motion-safe:animate-fade-in"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create client account"
        className="w-full max-w-md rounded-2xl bg-apex-850 ring-1 ring-white/10 shadow-2xl shadow-black/60 motion-safe:animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-white/10">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Create client account</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Spin up a new tenant. They get an empty CRM + welcome email.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-slate-100 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-6 space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30 px-4 py-3">
              <Check size={20} className="text-emerald-400 mt-0.5 shrink-0" />
              <div className="min-w-0 text-sm text-emerald-300">
                <div className="font-semibold">{tenantName.trim() || 'Account'} is live</div>
                <div className="mt-0.5 truncate text-xs text-emerald-300/80" title={ownerEmail}>
                  Owner account created for {ownerEmail}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-apex-800 ring-1 ring-white/10 p-4 text-sm space-y-1.5">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-medium mb-1">
                Login details (also emailed)
              </div>
              <div className="truncate"><span className="text-slate-400">URL:</span> <span className="text-slate-100 font-mono" title={window.location.origin}>{window.location.origin}</span></div>
              <div className="truncate"><span className="text-slate-400">Email:</span> <span className="text-slate-100 font-mono" title={ownerEmail}>{ownerEmail}</span></div>
              <div className="truncate"><span className="text-slate-400">Password:</span> <span className="text-slate-100 font-mono">{password}</span></div>
              <button
                onClick={copyCredentials}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-xs text-orange-400 hover:text-orange-300"
              >
                <Copy size={12} /> {copied ? 'Copied!' : 'Copy all'}
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  resetForm();
                }}
                className="flex-1 rounded-xl bg-apex-800 ring-1 ring-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-slate-100 transition"
              >
                Create another
              </button>
              <button
                onClick={handleClose}
                className="flex-1 rounded-xl bg-apex-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-950/50 hover:brightness-110 transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="px-6 py-5 space-y-4">
            <Field
              label="Business name"
              error={showError('tenantName')}
            >
              <input
                ref={firstFieldRef}
                value={tenantName}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={() => markTouched('tenantName')}
                aria-invalid={!!showError('tenantName')}
                placeholder="Acme Machine Shop"
                className={inputClass(!!showError('tenantName'))}
              />
            </Field>

            <Field
              label="Tenant slug (lowercase, unique)"
              hint="Used internally — they won't see it."
              error={showError('tenantSlug')}
            >
              <input
                value={tenantSlug}
                onChange={(e) => setTenantSlug(slugify(e.target.value))}
                onBlur={() => markTouched('tenantSlug')}
                aria-invalid={!!showError('tenantSlug')}
                placeholder="acme-machine"
                className={`${inputClass(!!showError('tenantSlug'))} font-mono`}
              />
            </Field>

            <Field label="Owner email" error={showError('ownerEmail')}>
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                onBlur={() => markTouched('ownerEmail')}
                aria-invalid={!!showError('ownerEmail')}
                placeholder="owner@acmemachine.com"
                className={inputClass(!!showError('ownerEmail'))}
              />
            </Field>

            <Field
              label="Temp password"
              hint="The owner gets this in their welcome email and can change it after signing in."
              error={showError('password')}
            >
              <div className="flex gap-2">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => markTouched('password')}
                  aria-invalid={!!showError('password')}
                  className={`${inputClass(!!showError('password'))} flex-1 font-mono`}
                />
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword())}
                  className="rounded-xl bg-white/10 px-3 text-xs font-medium text-slate-300 hover:bg-white/15 hover:text-slate-100 transition"
                >
                  Generate
                </button>
              </div>
            </Field>

            {notConfigured && <ServerSetupCallout />}

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-500/10 ring-1 ring-red-500/30 px-3 py-2 text-xs text-red-300">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-apex-accent px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-950/50 hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
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

/** Labeled field with an inline (blur/submit-triggered) validation message. */
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {error ? (
        <span className="mt-1 flex items-center gap-1 text-[11px] text-red-300">
          <AlertCircle size={11} className="shrink-0" />
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-[10px] text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}

function inputClass(invalid: boolean): string {
  return `w-full rounded-xl border bg-apex-800 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 transition ${
    invalid
      ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/60'
      : 'border-white/10 focus:ring-apex-accent/60 focus:border-apex-accent/60'
  }`;
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

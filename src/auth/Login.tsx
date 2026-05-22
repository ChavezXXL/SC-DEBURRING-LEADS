import React, { useState } from 'react';
import { Loader2, Lock, Mail, Check, ArrowLeft } from 'lucide-react';
import { useAuth } from './AuthContext';
import { FancyLogo } from '../shell/FancyLogo';

/**
 * Login screen — also handles the forgot-password flow via Firebase
 * sendPasswordResetEmail. iOS-style: soft rounded, generous whitespace.
 */
export function Login() {
  const { signIn, resetPassword, error } = useAuth();
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      /* surfaced via context.error */
    } finally {
      setBusy(false);
    }
  };

  const onSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setResetSent(false);
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch {
      /* surfaced via context.error */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-10">
          <FancyLogo className="w-16 h-16" />
          <h1 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
            Apex Growth
          </h1>
          <p className="mt-1 text-sm text-slate-500 text-center">
            {mode === 'signin' ? 'Sign in to your CRM' : 'Reset your password'}
          </p>
        </div>

        {/* Card */}
        {mode === 'signin' ? (
          <form
            onSubmit={onSignIn}
            className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/70 p-6 space-y-4"
          >
            <EmailInput value={email} onChange={setEmail} />
            <PasswordInput value={password} onChange={setPassword} />

            {error && <ErrorRow message={error} />}

            <button
              type="submit"
              disabled={busy || !email.trim() || !password}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {busy ? 'Signing in…' : 'Sign In'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setResetSent(false);
                }}
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                Forgot your password?
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={onSendReset}
            className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/70 p-6 space-y-4"
          >
            <p className="text-xs text-slate-500 leading-relaxed">
              Enter the email tied to your account. We'll send you a link to set a new
              password.
            </p>

            <EmailInput value={email} onChange={setEmail} />

            {resetSent && (
              <div className="flex items-start gap-2 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-3 py-2 text-xs text-emerald-800">
                <Check size={14} className="mt-0.5 shrink-0" />
                <span>
                  If an account exists for <strong>{email}</strong>, a reset link is on
                  its way. Check your inbox + spam.
                </span>
              </div>
            )}

            {error && !resetSent && <ErrorRow message={error} />}

            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {busy ? 'Sending…' : 'Send reset link'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setResetSent(false);
                }}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft size={12} />
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Need an account? Ask your administrator.
        </p>
      </div>
    </div>
  );
}

function EmailInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Email
      </span>
      <div className="mt-1 relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="email"
          required
          autoComplete="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="you@yourcompany.com"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
        />
      </div>
    </label>
  );
}

function PasswordInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Password
      </span>
      <div className="mt-1 relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="password"
          required
          autoComplete="current-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your password"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
        />
      </div>
    </label>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-red-50 ring-1 ring-red-100 px-3 py-2 text-xs text-red-700">
      {message}
    </div>
  );
}

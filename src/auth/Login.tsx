import React, { useState } from 'react';
import { Loader2, Lock, Mail, Check, ArrowLeft } from 'lucide-react';
import { useAuth } from './AuthContext';

/**
 * Login — the Apex Growth front door.
 *
 * Deliberately DARK while the app interior stays light: near-black graphite
 * ground, the chrome apex mark (a dark-ground asset, so it sits naturally),
 * molten-orange primary action, subtle chrome divider with a slow sheen
 * sweep (disabled under prefers-reduced-motion via `motion-safe:`).
 *
 * Also handles the forgot-password flow via Firebase sendPasswordResetEmail.
 * Auth logic is untouched — this is purely presentation.
 */

/** Molten orange — sampled from the lava edge of the apex mark. */
const APEX_ORANGE = '#F26D21';

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
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#08090C] px-4 py-10"
      style={{
        backgroundImage:
          // Faint chrome top-light + molten glow rising from the bottom edge.
          'linear-gradient(to bottom, rgba(255,255,255,0.045), transparent 18%),' +
          'radial-gradient(900px 380px at 50% 112%, rgba(242,109,33,0.16), transparent 65%)',
      }}
    >
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          {/* Same art as /apex-mark.png, resized — loads instantly. */}
          <img
            src="/icon-512.png"
            alt=""
            aria-hidden
            className="h-28 w-28 select-none object-cover [mask-image:radial-gradient(circle_at_50%_50%,black_58%,transparent_82%)]"
            draggable={false}
          />
          <h1 className="mt-2 text-lg font-semibold uppercase tracking-[0.32em] text-white">
            Apex&nbsp;Growth
          </h1>
          <p className="mt-2 text-xs tracking-wide text-slate-400">
            Sales CRM by Apex Growth
          </p>

          {/* Chrome divider with a slow molten sheen sweep (static line when
              the user prefers reduced motion). */}
          <div className="relative mt-6 mb-8 h-px w-full max-w-[13rem] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div
              className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-orange-400/80 to-transparent opacity-0 motion-safe:animate-apex-sheen"
              aria-hidden
            />
          </div>
        </div>

        {/* Card */}
        {mode === 'signin' ? (
          <form
            onSubmit={onSignIn}
            className="space-y-4 rounded-2xl bg-white/[0.04] p-6 shadow-2xl shadow-black/60 ring-1 ring-white/10 backdrop-blur-sm"
          >
            <EmailInput value={email} onChange={setEmail} autoFocus />
            <PasswordInput value={password} onChange={setPassword} />

            {error && <ErrorRow message={error} />}

            <button
              type="submit"
              disabled={busy || !email.trim() || !password}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-950/50 transition hover:brightness-110 active:scale-[0.99] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
              style={{ background: APEX_ORANGE }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? 'Signing in…' : 'Sign In'}
            </button>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setResetSent(false);
                }}
                className="text-xs font-medium text-slate-400 transition-colors hover:text-orange-400"
              >
                Forgot your password?
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={onSendReset}
            className="space-y-4 rounded-2xl bg-white/[0.04] p-6 shadow-2xl shadow-black/60 ring-1 ring-white/10 backdrop-blur-sm"
          >
            <p className="text-xs leading-relaxed text-slate-400">
              Enter the email tied to your account. We'll send you a link to set a new
              password.
            </p>

            <EmailInput value={email} onChange={setEmail} autoFocus />

            {resetSent && (
              <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-xs leading-relaxed text-emerald-200 ring-1 ring-emerald-400/30">
                <Check size={14} className="mt-0.5 shrink-0" />
                <span>
                  If an account exists for <strong className="font-semibold">{email}</strong>,
                  a reset link is on its way. Check your inbox + spam.
                </span>
              </div>
            )}

            {error && !resetSent && <ErrorRow message={error} />}

            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-950/50 transition hover:brightness-110 active:scale-[0.99] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
              style={{ background: APEX_ORANGE }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? 'Sending…' : 'Send reset link'}
            </button>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setResetSent(false);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-orange-400"
              >
                <ArrowLeft size={12} />
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-500">
          Need an account? Ask your administrator.
        </p>
      </div>
    </div>
  );
}

function EmailInput({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
        Email
      </span>
      <div className="relative mt-1.5">
        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="email"
          required
          autoComplete="email"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="you@yourcompany.com"
          className="w-full rounded-xl bg-white/[0.05] py-3 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 ring-1 ring-white/10 transition focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-orange-500/70"
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
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
        Password
      </span>
      <div className="relative mt-1.5">
        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="password"
          required
          autoComplete="current-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your password"
          className="w-full rounded-xl bg-white/[0.05] py-3 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 ring-1 ring-white/10 transition focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-orange-500/70"
        />
      </div>
    </label>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-red-500/10 px-3 py-2.5 text-xs leading-relaxed text-red-200 ring-1 ring-red-500/30">
      {message}
    </div>
  );
}

import React, { useState } from 'react';
import { Loader2, Lock, Mail } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { FancyLogo } from './FancyLogo';

/**
 * Login screen.
 * Soft rounded corners, lots of white space, subtle dividers — the iOS-style
 * direction Santiago wants for the eventual rebrand. Light by default.
 */
export function Login() {
  const { signIn, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      // error already surfaced via context
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
          <p className="mt-3 text-sm text-slate-500 text-center">
            Sign in to your CRM
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={onSubmit}
          className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/70 p-6 space-y-4"
        >
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourcompany.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              />
            </div>
          </label>

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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              />
            </div>
          </label>

          {error && (
            <div className="rounded-xl bg-red-50 ring-1 ring-red-100 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !email.trim() || !password}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Need an account? Ask your administrator.
        </p>
      </div>
    </div>
  );
}

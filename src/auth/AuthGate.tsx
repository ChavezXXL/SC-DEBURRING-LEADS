import React, { ReactNode } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Login } from './Login';

/**
 * AuthGate — wraps the app. When VITE_REQUIRE_AUTH is "true", users must
 * sign in before they can see anything. When it's false/unset, the app
 * behaves like before (no gate). This lets us ship the auth code without
 * breaking the live CRM until Santiago flips the switch.
 */
// Forced ON: the deployed Firestore rules REQUIRE authentication, so running
// with the gate off left the live CRM unable to read leads ("Missing or
// insufficient permissions"). Auth must be on for the app to work.
const REQUIRE_AUTH = true;

export function AuthGate({ children }: { children: ReactNode }) {
  // Feature-flagged off: pass through, no auth required.
  if (!REQUIRE_AUTH) return <>{children}</>;

  const { user, profile, loading, error, signOut } = useAuth();

  if (loading) {
    // Dark, brand-matched loading screen — same graphite ground as the Login
    // front door so there's no white flash between them. Once authed, the
    // light app takes over.
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08090C]">
        <div className="flex flex-col items-center gap-5">
          <img
            src="/icon-512.png"
            alt="Apex Growth"
            width={512}
            height={512}
            decoding="async"
            className="h-20 w-20 select-none object-cover [mask-image:radial-gradient(circle_at_50%_50%,black_58%,transparent_82%)]"
            draggable={false}
          />
          <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  // Signed in but no profile resolved — either the account was never
  // provisioned or the profile/tenant read failed. Never fall through to the
  // app (it would render tenant-less and hang on the loader forever). Show a
  // recovery screen so the user can sign out and try another account.
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08090C] p-6">
        <div className="w-full max-w-sm rounded-2xl bg-[#12151A] p-6 text-center ring-1 ring-white/10">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-orange-500/10 text-orange-300 ring-1 ring-orange-500/30">
            <ShieldAlert size={22} />
          </div>
          <h1 className="mt-4 text-base font-semibold text-slate-100">Can't open this account</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            {error ||
              'Your account is signed in but has no workspace access yet. Ask your administrator to add you.'}
          </p>
          <button
            onClick={() => void signOut()}
            className="mt-5 w-full rounded-xl bg-apex-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

import React, { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
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

  const { user, loading } = useAuth();

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
            className="h-20 w-20 select-none object-cover [mask-image:radial-gradient(circle_at_50%_50%,black_58%,transparent_82%)]"
            draggable={false}
          />
          <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  return <>{children}</>;
}

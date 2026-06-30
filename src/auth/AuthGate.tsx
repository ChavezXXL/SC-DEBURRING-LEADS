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
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!user) return <Login />;

  return <>{children}</>;
}

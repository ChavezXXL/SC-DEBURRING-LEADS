import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Tenant, UserProfile } from '../types';

/**
 * AuthContext — provides the current Firebase user, their UserProfile (which
 * tenant they belong to), and the Tenant document itself.
 *
 * Multi-tenant model:
 *   - Each login is mapped to a single `tenantId`.
 *   - Santiago's account = tenantId "sc-deburring", role "super-admin".
 *   - Future clients each get their own tenantId.
 *   - Firestore queries should filter by `tenantId` so each tenant only
 *     sees their own leads. (Wired in incrementally — first cut is just
 *     authentication, data isolation comes next.)
 */

interface AuthCtx {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  // Super-admin only: create a new tenant + first user for it.
  createTenantAccount: (args: {
    tenantId: string;
    tenantName: string;
    ownerEmail: string;
    ownerPassword: string;
    primaryColor?: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

/** Santiago's super-admin bootstrap. First time he signs in with this email,
 * he automatically becomes super-admin of the sc-deburring tenant. */
const BOOTSTRAP_SUPER_ADMIN_EMAIL = 'scprecisiondeburring@gmail.com';
const BOOTSTRAP_TENANT_ID = 'sc-deburring';
const BOOTSTRAP_TENANT_NAME = 'SC Deburring LLC';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (!fbUser) {
        setProfile(null);
        setTenant(null);
        setLoading(false);
        return;
      }
      try {
        // Load (or bootstrap) the user profile
        const profSnap = await getDoc(doc(db, 'users', fbUser.uid));
        let prof: UserProfile;
        if (profSnap.exists()) {
          prof = profSnap.data() as UserProfile;
        } else {
          // First-time login: if this is the bootstrap super-admin, create
          // their profile + the sc-deburring tenant if missing.
          const isSuperAdmin =
            fbUser.email?.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL;

          prof = {
            uid: fbUser.uid,
            email: fbUser.email || '',
            tenantId: isSuperAdmin ? BOOTSTRAP_TENANT_ID : BOOTSTRAP_TENANT_ID,
            role: isSuperAdmin ? 'super-admin' : 'member',
            displayName: fbUser.displayName || undefined,
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', fbUser.uid), prof);

          if (isSuperAdmin) {
            const tenantRef = doc(db, 'tenants', BOOTSTRAP_TENANT_ID);
            const tSnap = await getDoc(tenantRef);
            if (!tSnap.exists()) {
              const t: Tenant = {
                id: BOOTSTRAP_TENANT_ID,
                name: BOOTSTRAP_TENANT_NAME,
                ownerEmail: fbUser.email || '',
                createdAt: new Date().toISOString(),
                plan: 'internal',
              };
              await setDoc(tenantRef, t);
            }
          }
        }
        setProfile(prof);

        // Load the tenant doc
        if (prof.tenantId) {
          const tSnap = await getDoc(doc(db, 'tenants', prof.tenantId));
          if (tSnap.exists()) {
            setTenant(tSnap.data() as Tenant);
          } else {
            setTenant(null);
          }
        }
      } catch (e: any) {
        console.error('AuthProvider: error loading profile/tenant', e);
        setError(e?.message || 'Failed to load account');
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      const code = e?.code || '';
      let msg = 'Sign-in failed.';
      if (code.includes('user-not-found')) msg = 'No account for that email.';
      else if (code.includes('wrong-password') || code.includes('invalid-credential'))
        msg = 'Wrong password.';
      else if (code.includes('too-many-requests'))
        msg = 'Too many attempts. Wait a minute and try again.';
      else if (code.includes('network')) msg = 'Network error. Check your connection.';
      else if (e?.message) msg = e.message;
      setError(msg);
      throw e;
    }
  };

  const signOut = async () => {
    setError(null);
    await fbSignOut(auth);
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (e: any) {
      const code = e?.code || '';
      let msg = 'Could not send reset email.';
      if (code.includes('user-not-found')) msg = 'No account for that email.';
      else if (code.includes('invalid-email')) msg = 'That email looks invalid.';
      else if (code.includes('too-many-requests'))
        msg = 'Too many requests. Wait a minute.';
      else if (e?.message) msg = e.message;
      setError(msg);
      throw e;
    }
  };

  const createTenantAccount: AuthCtx['createTenantAccount'] = async (args) => {
    if (profile?.role !== 'super-admin') {
      throw new Error('Only the super-admin can create new accounts.');
    }
    if (!user) throw new Error('Not signed in.');
    // Server-side via /api/create-tenant-account so the super-admin stays
    // signed in and gets the welcome email sent automatically. The endpoint
    // verifies the caller's ID token + super-admin role before proceeding.
    const idToken = await user.getIdToken();
    const resp = await fetch('/api/create-tenant-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        tenantId: args.tenantId,
        tenantName: args.tenantName,
        ownerEmail: args.ownerEmail,
        ownerPassword: args.ownerPassword,
        primaryColor: args.primaryColor,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data?.error || `Failed (${resp.status})`);
    }
  };

  const value: AuthCtx = {
    user,
    profile,
    tenant,
    loading,
    error,
    signIn,
    signOut,
    resetPassword,
    createTenantAccount,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

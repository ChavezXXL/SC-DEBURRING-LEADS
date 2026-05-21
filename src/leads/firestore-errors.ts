/**
 * Centralized Firestore error decoding. Same logic that used to live inline
 * at the top of App.tsx.
 */

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string;
    providerInfo?: {
      providerId: string;
      displayName?: string;
      email?: string;
      photoUrl?: string;
    }[];
  };
}

/**
 * Detects permission-denied errors and rethrows them with a structured
 * JSON message so the calling component can surface it cleanly.
 */
export function handleFirestoreError(
  error: any,
  operationType: OperationType,
  path: string | null,
): never {
  const msg = error?.message || String(error);
  const code = error?.code || '';

  if (
    code.includes('permission-denied') ||
    msg.toLowerCase().includes('missing or insufficient permissions')
  ) {
    const errInfo: FirestoreErrorInfo = {
      error: msg,
      authInfo: { userId: undefined },
      operationType,
      path,
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }

  console.error('Firestore Error:', error);
  throw error;
}

/** Surface a Firestore-error JSON string as a plain message for the UI. */
export function extractErrorMessage(err: any): string {
  let msg = err?.message || String(err);
  try {
    msg = JSON.parse(msg).error || msg;
  } catch {
    // not JSON — use as-is
  }
  return msg;
}

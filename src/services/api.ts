/**
 * Hardened fetch for the app's own /api/* Pages Functions.
 *
 * When a Cloudflare function isn't fully configured (the one-time
 * FIREBASE_SERVICE_ACCOUNT secret is missing), the route falls through to the
 * SPA and returns index.html. Parsing that as JSON used to surface
 * "Unexpected token '<'" garbage to the owner. This helper collapses every
 * failure mode into ONE typed error the UI can render as a designed state:
 *
 *   - 'not-configured'  server answered with HTML / unparseable JSON, or an
 *                        error that names the missing secret → show the
 *                        friendly one-time-setup callout.
 *   - 'network'         fetch itself failed (offline, DNS, CORS).
 *   - 'server'          real JSON error from the API → show its message.
 */

export type ApiErrorKind = 'not-configured' | 'network' | 'server';

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

export const NOT_CONFIGURED_MESSAGE =
  "The server isn't fully configured yet — the FIREBASE_SERVICE_ACCOUNT key needs to be set on Cloudflare (one-time setup). Everything else in the app still works.";

export function isNotConfigured(e: unknown): boolean {
  return e instanceof ApiError && e.kind === 'not-configured';
}

/**
 * Fetch an /api/* endpoint and return parsed JSON, or throw ApiError.
 * Never lets an HTML response reach JSON.parse.
 */
export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(
      'network',
      "Couldn't reach the server — check your connection and try again.",
    );
  }

  // The function isn't live: Cloudflare served the SPA's index.html instead.
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('json')) {
    throw new ApiError('not-configured', NOT_CONFIGURED_MESSAGE, res.status);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new ApiError('not-configured', NOT_CONFIGURED_MESSAGE, res.status);
  }

  if (!res.ok) {
    const msg =
      typeof data?.error === 'string' && data.error.trim()
        ? data.error
        : `Request failed (${res.status})`;
    // A 500 that names the missing secret is still a setup problem, not a user problem.
    if (/FIREBASE_SERVICE_ACCOUNT/i.test(msg)) {
      throw new ApiError('not-configured', NOT_CONFIGURED_MESSAGE, res.status);
    }
    throw new ApiError('server', msg, res.status);
  }

  return data as T;
}

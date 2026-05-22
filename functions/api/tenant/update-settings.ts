/**
 * POST /api/tenant/update-settings
 *
 * Tenant-scoped (NOT admin-only). The signed-in user can update the tenant
 * doc they belong to — name, primary color, logo URL. Super-admin can edit
 * any tenant.
 *
 * Cannot change: id, ownerEmail, createdAt, plan, disabled, disabledAt.
 *
 * Body:
 *   { idToken, tenantId, name?, primaryColor?, logoUrl? }
 */
import {
  AdminEnv,
  ServiceAccount,
  getAccessToken,
  verifyIdToken,
  firestoreGet,
  firestorePatch,
  fromFirestoreValue,
  jsonResp,
  errorResp,
  httpError,
} from '../../_shared/admin';

interface Body {
  idToken: string;
  tenantId: string;
  name?: string;
  primaryColor?: string;
  logoUrl?: string;
}

type CtxArg = { request: Request; env: AdminEnv };

export const onRequestPost = async ({ request, env }: CtxArg): Promise<Response> => {
  try {
    if (!env.FIREBASE_SERVICE_ACCOUNT) {
      throw httpError(500, 'Server missing FIREBASE_SERVICE_ACCOUNT secret');
    }
    const body = (await request.json()) as Body;
    if (!body.idToken || !body.tenantId) throw httpError(400, 'Missing idToken or tenantId');

    const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
    const projectId = sa.project_id;
    const accessToken = await getAccessToken(sa);

    const caller = await verifyIdToken(body.idToken, projectId);
    const callerProfile = await firestoreGet(projectId, accessToken, `users/${caller.uid}`);
    const role = fromFirestoreValue(callerProfile?.fields?.role);
    const callerTenantId = fromFirestoreValue(callerProfile?.fields?.tenantId);

    // Either super-admin OR owner/member of the target tenant
    if (role !== 'super-admin' && callerTenantId !== body.tenantId) {
      throw httpError(403, "You can only edit your own tenant's settings.");
    }
    // Only owners and super-admins can edit settings (not "member" role)
    if (role !== 'super-admin' && role !== 'owner') {
      throw httpError(403, 'Only the tenant owner can change settings.');
    }

    const existing = await firestoreGet(projectId, accessToken, `tenants/${body.tenantId}`);
    if (!existing) throw httpError(404, 'Tenant not found');

    const updates: Record<string, any> = {};
    const mask: string[] = [];

    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim();
      mask.push('name');
    }
    if (typeof body.primaryColor === 'string') {
      // Accept "#RRGGBB" hex format only
      if (!/^#[0-9a-f]{6}$/i.test(body.primaryColor.trim())) {
        throw httpError(400, 'primaryColor must be a #RRGGBB hex string');
      }
      updates.primaryColor = body.primaryColor.trim();
      mask.push('primaryColor');
    }
    if (typeof body.logoUrl === 'string') {
      // Either empty (clear it) or a valid http(s) URL
      const trimmed = body.logoUrl.trim();
      if (trimmed && !/^https?:\/\//i.test(trimmed)) {
        throw httpError(400, 'logoUrl must be a full http(s) URL');
      }
      updates.logoUrl = trimmed;
      mask.push('logoUrl');
    }

    if (mask.length === 0) throw httpError(400, 'No updates provided');

    await firestorePatch(projectId, accessToken, `tenants/${body.tenantId}`, updates, mask);
    return jsonResp({ success: true, tenantId: body.tenantId, updates });
  } catch (err) {
    return errorResp(err);
  }
};

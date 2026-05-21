/**
 * POST /api/admin/update-tenant
 *
 * Super-admin only. Updates a tenant's disabled flag and/or plan.
 *
 * Body:
 *   {
 *     idToken: string,
 *     tenantId: string,
 *     disabled?: boolean,
 *     plan?: 'trial' | 'paid' | 'internal',
 *     name?: string,
 *     primaryColor?: string,
 *   }
 */
import {
  AdminEnv,
  requireSuperAdmin,
  firestoreGet,
  firestorePatch,
  jsonResp,
  errorResp,
  httpError,
} from '../../_shared/admin';

interface Body {
  idToken: string;
  tenantId: string;
  disabled?: boolean;
  plan?: 'trial' | 'paid' | 'internal';
  name?: string;
  primaryColor?: string;
}

type CtxArg = { request: Request; env: AdminEnv };

export const onRequestPost = async ({ request, env }: CtxArg): Promise<Response> => {
  try {
    const body = (await request.json()) as Body;
    const { projectId, accessToken } = await requireSuperAdmin(env, body.idToken);

    if (!body.tenantId) throw httpError(400, 'Missing tenantId');

    const existing = await firestoreGet(projectId, accessToken, `tenants/${body.tenantId}`);
    if (!existing) throw httpError(404, `Tenant "${body.tenantId}" not found`);

    const updates: Record<string, any> = {};
    const mask: string[] = [];
    if (typeof body.disabled === 'boolean') {
      updates.disabled = body.disabled;
      mask.push('disabled');
      if (body.disabled) {
        updates.disabledAt = new Date().toISOString();
        mask.push('disabledAt');
      }
    }
    if (body.plan) {
      updates.plan = body.plan;
      mask.push('plan');
    }
    if (body.name) {
      updates.name = body.name;
      mask.push('name');
    }
    if (body.primaryColor) {
      updates.primaryColor = body.primaryColor;
      mask.push('primaryColor');
    }
    if (mask.length === 0) throw httpError(400, 'No updates provided');

    await firestorePatch(projectId, accessToken, `tenants/${body.tenantId}`, updates, mask);
    return jsonResp({ success: true, tenantId: body.tenantId, updates });
  } catch (err) {
    return errorResp(err);
  }
};

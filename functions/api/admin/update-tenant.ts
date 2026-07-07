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
  logAdminAction,
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
    const { projectId, accessToken, callerUid, callerEmail } = await requireSuperAdmin(
      env,
      body.idToken,
    );

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

    // Audit trail (best-effort — never fails the action).
    const parts: string[] = [];
    if (typeof body.disabled === 'boolean') parts.push(body.disabled ? 'disabled' : 're-enabled');
    if (body.plan) parts.push(`plan → ${body.plan}`);
    if (body.name) parts.push(`name → ${body.name}`);
    if (body.primaryColor) parts.push(`color → ${body.primaryColor}`);
    await logAdminAction(projectId, accessToken, {
      action: 'tenant.updated',
      actorUid: callerUid,
      actorEmail: callerEmail,
      targetTenantId: body.tenantId,
      detail: parts.join(', '),
    });

    return jsonResp({ success: true, tenantId: body.tenantId, updates });
  } catch (err) {
    return errorResp(err);
  }
};

/**
 * POST /api/admin/delete-tenant
 *
 * Super-admin only. CASCADE deletes a tenant + all its users (from Firebase
 * Auth + Firestore) + all its leads + outreach logs.
 *
 * Destructive. Requires explicit confirm string matching the tenant slug.
 *
 * Body:
 *   { idToken: string, tenantId: string, confirm: string }
 */
import {
  AdminEnv,
  requireSuperAdmin,
  firestoreGet,
  firestoreDelete,
  firestoreStructuredQuery,
  docToObject,
  deleteAuthUser,
  logAdminAction,
  jsonResp,
  errorResp,
  httpError,
} from '../../_shared/admin';

interface Body {
  idToken: string;
  tenantId: string;
  confirm: string;
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
    if (body.confirm !== body.tenantId) {
      throw httpError(400, `Confirm string must match the tenant slug exactly ("${body.tenantId}")`);
    }
    if (body.tenantId === 'sc-deburring') {
      throw httpError(400, 'Refusing to delete the sc-deburring tenant. Disable it instead.');
    }

    const existing = await firestoreGet(projectId, accessToken, `tenants/${body.tenantId}`);
    if (!existing) throw httpError(404, `Tenant "${body.tenantId}" not found`);

    const summary = { leadsDeleted: 0, logsDeleted: 0, usersDeleted: 0 };

    // 1) delete leads for this tenant
    const leadRows = await firestoreStructuredQuery(projectId, accessToken, {
      structuredQuery: {
        from: [{ collectionId: 'leads' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'tenantId' },
            op: 'EQUAL',
            value: { stringValue: body.tenantId },
          },
        },
      },
    });
    for (const row of leadRows) {
      if (!row.document) continue;
      const docPath = row.document.name.split('/documents/')[1]; // "leads/{id}"
      await firestoreDelete(projectId, accessToken, docPath);
      summary.leadsDeleted++;
    }

    // 2) delete outreach logs for this tenant
    const logRows = await firestoreStructuredQuery(projectId, accessToken, {
      structuredQuery: {
        from: [{ collectionId: 'outreach-logs' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'tenantId' },
            op: 'EQUAL',
            value: { stringValue: body.tenantId },
          },
        },
      },
    });
    for (const row of logRows) {
      if (!row.document) continue;
      const docPath = row.document.name.split('/documents/')[1];
      await firestoreDelete(projectId, accessToken, docPath);
      summary.logsDeleted++;
    }

    // 3) delete users in this tenant (auth + profile)
    const userRows = await firestoreStructuredQuery(projectId, accessToken, {
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'tenantId' },
            op: 'EQUAL',
            value: { stringValue: body.tenantId },
          },
        },
      },
    });
    for (const row of userRows) {
      if (!row.document) continue;
      const profile = docToObject(row.document);
      if (profile.uid) {
        try {
          await deleteAuthUser(projectId, accessToken, profile.uid);
        } catch (e) {
          console.warn('Auth delete failed for', profile.uid, e);
        }
      }
      const docPath = row.document.name.split('/documents/')[1];
      await firestoreDelete(projectId, accessToken, docPath);
      summary.usersDeleted++;
    }

    // 4) delete the tenant doc
    await firestoreDelete(projectId, accessToken, `tenants/${body.tenantId}`);

    // Audit trail — deletions especially must leave a record.
    await logAdminAction(projectId, accessToken, {
      action: 'tenant.deleted',
      actorUid: callerUid,
      actorEmail: callerEmail,
      targetTenantId: body.tenantId,
      detail: `${summary.leadsDeleted} leads, ${summary.logsDeleted} logs, ${summary.usersDeleted} users removed`,
    });

    return jsonResp({ success: true, tenantId: body.tenantId, summary });
  } catch (err) {
    return errorResp(err);
  }
};

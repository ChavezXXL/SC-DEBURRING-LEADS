/**
 * GET /api/admin/list-tenants
 *
 * Super-admin only. Returns every tenant in Firestore with its computed
 * lead count and user count.
 *
 * Headers:
 *   Authorization: Bearer <firebase-id-token>
 */
import {
  AdminEnv,
  requireSuperAdmin,
  firestoreListCollection,
  firestoreStructuredQuery,
  docToObject,
  jsonResp,
  errorResp,
} from '../../_shared/admin';

type CtxArg = { request: Request; env: AdminEnv };

export const onRequestGet = async ({ request, env }: CtxArg): Promise<Response> => {
  try {
    const idToken = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { projectId, accessToken } = await requireSuperAdmin(env, idToken);

    // 1) all tenants
    const tenantDocs = await firestoreListCollection(projectId, accessToken, 'tenants');
    const tenants = tenantDocs.map((d) => ({ id: d.name.split('/').pop(), ...docToObject(d) }));

    // 2) all users — group by tenantId
    const userDocs = await firestoreListCollection(projectId, accessToken, 'users');
    const usersByTenant = new Map<string, number>();
    for (const u of userDocs) {
      const tId = docToObject(u).tenantId;
      if (tId) usersByTenant.set(tId, (usersByTenant.get(tId) || 0) + 1);
    }

    // 3) lead counts per tenant (one structured query per tenant — small N).
    // For tenants with no leads, this is fine and fast.
    const stats = await Promise.all(
      tenants.map(async (t: any) => {
        try {
          const result = await firestoreStructuredQuery(projectId, accessToken, {
            structuredQuery: {
              from: [{ collectionId: 'leads' }],
              where: {
                fieldFilter: {
                  field: { fieldPath: 'tenantId' },
                  op: 'EQUAL',
                  value: { stringValue: t.id },
                },
              },
              select: { fields: [{ fieldPath: 'tenantId' }] },
            },
          });
          const leadCount = result.filter((r: any) => r.document).length;
          return {
            ...t,
            leadCount,
            userCount: usersByTenant.get(t.id) || 0,
          };
        } catch {
          return { ...t, leadCount: 0, userCount: usersByTenant.get(t.id) || 0 };
        }
      }),
    );

    return jsonResp({ tenants: stats });
  } catch (err) {
    return errorResp(err);
  }
};

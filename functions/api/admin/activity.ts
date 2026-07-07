/**
 * GET /api/admin/activity
 *
 * Super-admin only. Returns the most recent platform events from the
 * `admin-logs` audit collection (written server-side by every admin action —
 * client created, plan/access changes, deletions, password resets, branding).
 *
 * Headers:
 *   Authorization: Bearer <firebase-id-token>
 */
import {
  AdminEnv,
  requireSuperAdmin,
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

    // Single-field DESC order — no composite index needed.
    const rows = await firestoreStructuredQuery(projectId, accessToken, {
      structuredQuery: {
        from: [{ collectionId: 'admin-logs' }],
        orderBy: [{ field: { fieldPath: 'at' }, direction: 'DESCENDING' }],
        limit: 60,
      },
    });

    const events = rows
      .filter((r: any) => r.document)
      .map((r: any) => ({
        id: r.document.name.split('/').pop(),
        ...docToObject(r.document),
      }));

    return jsonResp({ events });
  } catch (err) {
    return errorResp(err);
  }
};

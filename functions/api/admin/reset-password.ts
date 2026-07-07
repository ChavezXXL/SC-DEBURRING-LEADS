/**
 * POST /api/admin/reset-password
 *
 * Super-admin only. Generates a new temporary password for a user, sets it on
 * Firebase Auth, and emails the user the new credentials.
 *
 * Body: { idToken: string, targetUid: string }
 */
import {
  AdminEnv,
  requireSuperAdmin,
  firestoreGet,
  updateAuthPassword,
  sendResendEmail,
  docToObject,
  logAdminAction,
  jsonResp,
  errorResp,
  httpError,
} from '../../_shared/admin';

interface Body {
  idToken: string;
  targetUid: string;
}

type CtxArg = { request: Request; env: AdminEnv };

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pw = '';
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  for (let i = 0; i < length; i++) pw += chars[buf[i] % chars.length];
  return pw;
}

export const onRequestPost = async ({ request, env }: CtxArg): Promise<Response> => {
  try {
    const body = (await request.json()) as Body;
    const { projectId, accessToken, callerUid, callerEmail } = await requireSuperAdmin(
      env,
      body.idToken,
    );
    if (!body.targetUid) throw httpError(400, 'Missing targetUid');

    const userDoc = await firestoreGet(projectId, accessToken, `users/${body.targetUid}`);
    if (!userDoc) throw httpError(404, 'User not found');
    const profile = docToObject(userDoc);

    const newPassword = generatePassword();
    await updateAuthPassword(projectId, accessToken, body.targetUid, newPassword);

    // Send email with new password
    const appUrl = env.APP_URL || 'https://apx-crm.pages.dev';
    await sendResendEmail(
      env,
      profile.email,
      'Your CRM password has been reset',
      `Your CRM password was reset by an administrator.

Sign in at: ${appUrl}
Email:      ${profile.email}
Password:   ${newPassword}

For security, please sign in and change your password right away.

Apex Growth
`,
    );

    // Audit trail — records WHO reset WHOSE password, never the password itself.
    await logAdminAction(projectId, accessToken, {
      action: 'password.reset',
      actorUid: callerUid,
      actorEmail: callerEmail,
      targetTenantId: profile.tenantId,
      detail: `for ${profile.email}`,
    });

    return jsonResp({ success: true, email: profile.email, newPassword });
  } catch (err) {
    return errorResp(err);
  }
};

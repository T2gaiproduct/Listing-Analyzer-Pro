export function inviteEmailTemplate({
  inviterName,
  companyName,
  inviteUrl,
  role,
  invitedName,
}: {
  inviterName: string;
  companyName: string;
  inviteUrl: string;
  role: string;
  invitedName: string;
}): string {
  const roleDescriptions: Record<string, string> = {
    admin: "Full access — can manage team, billing, and all audits",
    editor: "Can create and edit audits, cannot manage billing or team",
    viewer: "Read-only access to audits and reports",
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #f97316; padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .header p { color: #ffedd5; margin: 8px 0 0; font-size: 14px; }
    .content { padding: 32px 24px; }
    .content p { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .content strong { color: #0f172a; }
    .role-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin: 20px 0; }
    .role-box .role-label { color: #f97316; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .role-box .role-desc { color: #475569; font-size: 13px; margin: 0; }
    .btn-wrapper { text-align: center; margin: 28px 0 16px; }
    .btn { display: inline-block; background: #f97316; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; }
    .footer { background: #f8fafc; padding: 20px 24px; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
    .footer a { color: #f97316; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Team Invitation</h1>
      <p>You have been invited to join ${companyName}</p>
    </div>
    <div class="content">
      <p>Hi <strong>${invitedName}</strong>,</p>
      <p><strong>${inviterName}</strong> has invited you to join their team workspace on <strong>Ecommerce Guru</strong>.</p>
      <div class="role-box">
        <div class="role-label">Your role: ${role}</div>
        <p class="role-desc">${roleDescriptions[role] ?? "Team member access"}</p>
      </div>
      <div class="btn-wrapper">
        <a href="${inviteUrl}" class="btn">Accept Invitation</a>
      </div>
      <p style="font-size: 13px; color: #94a3b8; text-align: center;">If the button above does not work, copy and paste this link into your browser:<br><a href="${inviteUrl}" style="color: #f97316; word-break: break-all;">${inviteUrl}</a></p>
    </div>
    <div class="footer">
      <p>Ecommerce Guru — AI-powered Amazon listing optimization</p>
    </div>
  </div>
</body>
</html>`;
}

export function welcomeEmailTemplate({
  companyName,
  memberName,
  role,
}: {
  companyName: string;
  memberName: string;
  role: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to the Team</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #f97316; padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .content { padding: 32px 24px; }
    .content p { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .content strong { color: #0f172a; }
    .btn-wrapper { text-align: center; margin: 28px 0 16px; }
    .btn { display: inline-block; background: #f97316; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; }
    .footer { background: #f8fafc; padding: 20px 24px; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to the Team!</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${memberName}</strong>,</p>
      <p>You have been successfully added to <strong>${companyName}</strong> on <strong>Ecommerce Guru</strong>.</p>
      <p>Your assigned role is <strong>${role}</strong>. You can now access the team workspace and start collaborating.</p>
      <div class="btn-wrapper">
        <a href="${process.env.APP_URL ?? "https://sellerlens.io"}/dashboard" class="btn">Go to Dashboard</a>
      </div>
    </div>
    <div class="footer">
      <p>Ecommerce Guru — AI-powered Amazon listing optimization</p>
    </div>
  </div>
</body>
</html>`;
}

export function workspaceInviteEmailTemplate({
  invitedName,
  workspaceName,
  roleName,
  inviterName,
  inviteUrl,
}: {
  invitedName: string;
  workspaceName: string;
  roleName: string;
  inviterName: string;
  inviteUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workspace Invitation</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #f97316; padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .header p { color: #ffedd5; margin: 8px 0 0; font-size: 14px; }
    .content { padding: 32px 24px; }
    .content p { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .content strong { color: #0f172a; }
    .role-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin: 20px 0; }
    .role-box .role-label { color: #f97316; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .role-box .workspace-name { color: #0f172a; font-size: 16px; font-weight: 700; margin: 0 0 8px; }
    .role-box .role-desc { color: #475569; font-size: 13px; margin: 0; }
    .btn-wrapper { text-align: center; margin: 28px 0 16px; }
    .btn { display: inline-block; background: #f97316; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; }
    .footer { background: #f8fafc; padding: 20px 24px; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Workspace Invitation</h1>
      <p>Join <strong>${workspaceName}</strong> on Ecommerce Guru</p>
    </div>
    <div class="content">
      <p>Hi <strong>${invitedName}</strong>,</p>
      <p><strong>${inviterName}</strong> has invited you to join the workspace below on <strong>Ecommerce Guru</strong>.</p>
      <div class="role-box">
        <div class="role-label">Workspace</div>
        <p class="workspace-name">${workspaceName}</p>
        <div class="role-label">Your role</div>
        <p class="role-desc">${roleName}</p>
      </div>
      <div class="btn-wrapper">
        <a href="${inviteUrl}" class="btn">Accept invitation</a>
      </div>
      <p style="font-size: 13px; color: #94a3b8; text-align: center;">If the button above does not work, copy and paste this link into your browser:<br><a href="${inviteUrl}" style="color: #f97316; word-break: break-all;">${inviteUrl}</a></p>
    </div>
    <div class="footer">
      <p>Ecommerce Guru — AI-powered Amazon listing optimization</p>
    </div>
  </div>
</body>
</html>`;
}

export function adminRoleAssignedEmailTemplate({
  recipientName,
  roleName,
  permissionLabels,
  adminSignInUrl,
  assignedByName,
  isUpdate,
}: {
  recipientName: string;
  roleName: string;
  permissionLabels: string[];
  adminSignInUrl: string;
  assignedByName: string;
  isUpdate?: boolean;
}): string {
  const permissionList = permissionLabels.length
    ? permissionLabels.map((label) => `<li>${label}</li>`).join("")
    : "<li>Limited admin access (see your administrator for details)</li>";

  const headline = isUpdate ? "Your admin role was updated" : "You've been granted admin access";
  const intro = isUpdate
    ? `<strong>${assignedByName}</strong> updated your admin role on <strong>Ecommerce Guru</strong>.`
    : `<strong>${assignedByName}</strong> assigned you an admin role on <strong>Ecommerce Guru</strong>.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Access</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #f97316; padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .header p { color: #ffedd5; margin: 8px 0 0; font-size: 14px; }
    .content { padding: 32px 24px; }
    .content p { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .content strong { color: #0f172a; }
    .role-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin: 20px 0; }
    .role-box .role-label { color: #f97316; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .perms { margin: 12px 0 0; padding-left: 18px; color: #475569; font-size: 14px; line-height: 1.5; }
    .btn-wrapper { text-align: center; margin: 28px 0 16px; }
    .btn { display: inline-block; background: #f97316; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; }
    .footer { background: #f8fafc; padding: 20px 24px; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${headline}</h1>
      <p>Ecommerce Guru Admin</p>
    </div>
    <div class="content">
      <p>Hi <strong>${recipientName}</strong>,</p>
      <p>${intro}</p>
      <div class="role-box">
        <div class="role-label">Role: ${roleName}</div>
        <p style="margin: 8px 0 4px; color: #475569; font-size: 14px;">You can access these admin areas:</p>
        <ul class="perms">${permissionList}</ul>
      </div>
      <p>Sign in with this email address, then open the admin panel using the button below.</p>
      <div class="btn-wrapper">
        <a href="${adminSignInUrl}" class="btn">Sign in to Admin</a>
      </div>
      <p style="font-size: 13px; color: #94a3b8; text-align: center;">If the button does not work, copy this link:<br><a href="${adminSignInUrl}" style="color: #f97316; word-break: break-all;">${adminSignInUrl}</a></p>
    </div>
    <div class="footer">
      <p>Ecommerce Guru — AI-powered Amazon listing optimization</p>
    </div>
  </div>
</body>
</html>`;
}

export function adminRoleInviteEmailTemplate({
  roleName,
  permissionLabels,
  signUpUrl,
  assignedByName,
  invitedEmail,
}: {
  roleName: string;
  permissionLabels: string[];
  signUpUrl: string;
  assignedByName: string;
  invitedEmail: string;
}): string {
  const permissionList = permissionLabels.length
    ? permissionLabels.map((label) => `<li>${label}</li>`).join("")
    : "<li>Limited admin access (see your administrator for details)</li>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Invitation</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #f97316; padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .header p { color: #ffedd5; margin: 8px 0 0; font-size: 14px; }
    .content { padding: 32px 24px; }
    .content p { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .content strong { color: #0f172a; }
    .role-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin: 20px 0; }
    .role-box .role-label { color: #f97316; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .perms { margin: 12px 0 0; padding-left: 18px; color: #475569; font-size: 14px; line-height: 1.5; }
    .btn-wrapper { text-align: center; margin: 28px 0 16px; }
    .btn { display: inline-block; background: #f97316; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; }
    .footer { background: #f8fafc; padding: 20px 24px; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>You're invited to Ecommerce Guru Admin</h1>
      <p>Create your account to get started</p>
    </div>
    <div class="content">
      <p><strong>${assignedByName}</strong> invited you to join <strong>Ecommerce Guru</strong> as an admin user.</p>
      <div class="role-box">
        <div class="role-label">Role: ${roleName}</div>
        <p style="margin: 8px 0 4px; color: #475569; font-size: 14px;">After sign-up you can access:</p>
        <ul class="perms">${permissionList}</ul>
      </div>
      <p>Create an account using this email address:</p>
      <p style="text-align:center;"><strong>${invitedEmail}</strong></p>
      <div class="btn-wrapper">
        <a href="${signUpUrl}" class="btn">Accept Invitation</a>
      </div>
      <p style="font-size: 13px; color: #94a3b8; text-align: center;">If the button does not work, copy this link:<br><a href="${signUpUrl}" style="color: #f97316; word-break: break-all;">${signUpUrl}</a></p>
    </div>
    <div class="footer">
      <p>Ecommerce Guru — AI-powered Amazon listing optimization</p>
    </div>
  </div>
</body>
</html>`;
}

export function notificationEmailTemplate({
  recipientName,
  title,
  message,
  actionUrl,
}: {
  recipientName: string;
  title: string;
  message: string;
  actionUrl?: string;
}): string {
  const actionBlock = actionUrl
    ? `<div class="btn-wrapper"><a href="${actionUrl}" class="btn">View in Ecommerce Guru</a></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #f97316; padding: 28px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; }
    .content { padding: 28px 24px; }
    .content p { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .content strong { color: #0f172a; }
    .btn-wrapper { text-align: center; margin: 24px 0 8px; }
    .btn { display: inline-block; background: #f97316; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 15px; }
    .footer { background: #f8fafc; padding: 20px 24px; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${title}</h1></div>
    <div class="content">
      <p>Hi <strong>${recipientName}</strong>,</p>
      <p>${message}</p>
      ${actionBlock}
    </div>
    <div class="footer"><p>Ecommerce Guru — AI-powered listing optimization</p></div>
  </div>
</body>
</html>`;
}

export function authPasswordResetTemplate({
  platformName,
  resetUrl,
  resetCode,
  expiresMinutes,
}: {
  platformName: string;
  resetUrl: string;
  resetCode: string;
  expiresMinutes: number;
}): string {
  const app = platformName.trim() || "Ecommerce Guru";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #f97316; padding: 28px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; }
    .content { padding: 32px 24px; text-align: center; }
    .content p { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .code { font-size: 14px; font-weight: 600; color: #0f172a; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0; word-break: break-all; font-family: ui-monospace, monospace; }
    .btn { display: inline-block; background: #f97316; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 15px; margin: 16px 0; }
    .footer { background: #f8fafc; padding: 20px 24px; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Reset your password</h1></div>
    <div class="content">
      <p>We received a request to reset your password for <strong>${app}</strong>.</p>
      <a href="${resetUrl}" class="btn">Reset password</a>
      <p style="font-size: 14px; color: #475569;">Or open <strong>Sign in → Forgot password → Enter reset code</strong> and paste:</p>
      <div class="code">${resetCode}</div>
      <p style="font-size: 13px; color: #94a3b8;">This code expires in ${expiresMinutes} minutes. If you did not request this, you can ignore this email.</p>
    </div>
    <div class="footer"><p>${resetUrl}</p></div>
  </div>
</body>
</html>`;
}

export function authEmailCodeTemplate({
  platformName,
  code,
  expiresMinutes,
  headline = "Verify your email",
  intro,
  ctaUrl,
  ctaLabel,
}: {
  platformName: string;
  code: string;
  expiresMinutes: number;
  headline?: string;
  intro?: string;
  ctaUrl?: string;
  ctaLabel?: string;
}): string {
  const app = platformName.trim() || "Ecommerce Guru";
  const introHtml =
    intro ??
    `Enter this verification code to continue to <strong>${app}</strong>:`;
  const ctaHtml =
    ctaUrl && ctaLabel
      ? `<a href="${ctaUrl}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;margin:8px 0 16px;">${ctaLabel}</a>`
      : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #f97316; padding: 28px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; }
    .content { padding: 32px 24px; text-align: center; }
    .content p { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .code { font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .footer { background: #f8fafc; padding: 20px 24px; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${headline}</h1></div>
    <div class="content">
      <p>${introHtml}</p>
      <div class="code">${code}</div>
      ${ctaHtml}
      <p style="font-size: 13px; color: #94a3b8;">This code expires in ${expiresMinutes} minutes. If you did not request this, you can ignore this email.</p>
    </div>
    <div class="footer"><p>Ecommerce Guru — AI-powered listing optimization</p></div>
  </div>
</body>
</html>`;
}

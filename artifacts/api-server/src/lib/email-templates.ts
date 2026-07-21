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
      <p><strong>${inviterName}</strong> has invited you to join their team workspace on <strong>SellerLens</strong>.</p>
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
      <p>SellerLens — AI-powered Amazon listing optimization</p>
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
      <p>You have been successfully added to <strong>${companyName}</strong> on <strong>SellerLens</strong>.</p>
      <p>Your assigned role is <strong>${role}</strong>. You can now access the team workspace and start collaborating.</p>
      <div class="btn-wrapper">
        <a href="${process.env.APP_URL ?? "https://listingauditor.com"}/dashboard" class="btn">Go to Dashboard</a>
      </div>
    </div>
    <div class="footer">
      <p>SellerLens — AI-powered Amazon listing optimization</p>
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
    ? `<strong>${assignedByName}</strong> updated your admin role on <strong>SellerLens</strong>.`
    : `<strong>${assignedByName}</strong> assigned you an admin role on <strong>SellerLens</strong>.`;

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
      <p>SellerLens Admin</p>
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
      <p>SellerLens — AI-powered Amazon listing optimization</p>
    </div>
  </div>
</body>
</html>`;
}

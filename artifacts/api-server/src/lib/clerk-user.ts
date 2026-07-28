const CLERK_API_BASE = "https://api.clerk.com/v1";

export async function fetchClerkUserIdByEmail(email: string): Promise<string | null> {
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) return null;

  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  try {
    const res = await fetch(
      `${CLERK_API_BASE}/users?email_address=${encodeURIComponent(normalized)}&limit=1`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown> | unknown[];
    const users = Array.isArray(data) ? data : ((data as Record<string, unknown>).data as unknown[] ?? []);
    const first = users[0] as Record<string, unknown> | undefined;
    const id = first?.id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

export async function fetchClerkUserEmailAndName(userId: string): Promise<{ email: string; name: string } | null> {
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) return null;

  try {
    const res = await fetch(`${CLERK_API_BASE}/users/${userId}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) return null;

    const cu = (await res.json()) as Record<string, unknown>;
    const emails = cu.email_addresses as Array<{ email_address: string }> | undefined;
    const email = emails?.[0]?.email_address?.trim();
    if (!email) return null;

    const fullName = [cu.first_name as string, cu.last_name as string].filter(Boolean).join(" ").trim();
    return { email, name: fullName || email };
  } catch {
    return null;
  }
}

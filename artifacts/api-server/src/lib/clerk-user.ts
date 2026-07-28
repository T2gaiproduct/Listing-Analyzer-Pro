const CLERK_API_BASE = "https://api.clerk.com/v1";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseClerkUserList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw as Record<string, unknown>[];
  }
  if (raw && typeof raw === "object") {
    const data = (raw as Record<string, unknown>).data;
    if (Array.isArray(data)) {
      return data as Record<string, unknown>[];
    }
  }
  return [];
}

function clerkUserMatchesEmail(user: Record<string, unknown>, normalizedEmail: string): boolean {
  const emails = user.email_addresses as Array<{ email_address?: string }> | undefined;
  if (!emails?.length) return false;
  return emails.some((entry) => normalizeEmail(entry.email_address ?? "") === normalizedEmail);
}

function clerkUserIdFromRecord(user: Record<string, unknown>): string | null {
  const id = user.id;
  return typeof id === "string" ? id : null;
}

async function clerkFetchUsersByEmail(normalizedEmail: string, secret: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `${CLERK_API_BASE}/users?email_address=${encodeURIComponent(normalizedEmail)}&limit=10`,
    { headers: { Authorization: `Bearer ${secret}` } },
  );
  if (!res.ok) return [];

  const users = parseClerkUserList(await res.json());
  const exact = users.filter((user) => clerkUserMatchesEmail(user, normalizedEmail));
  return exact.length > 0 ? exact : users;
}

export async function fetchClerkUserIdByEmail(email: string): Promise<string | null> {
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) return null;

  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  try {
    const users = await clerkFetchUsersByEmail(normalized, secret);
    for (const user of users) {
      if (clerkUserMatchesEmail(user, normalized)) {
        return clerkUserIdFromRecord(user);
      }
    }
    const first = users[0];
    return first ? clerkUserIdFromRecord(first) : null;
  } catch {
    return null;
  }
}

export async function clerkAccountExistsForEmail(email: string): Promise<boolean> {
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) return false;

  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  try {
    const users = await clerkFetchUsersByEmail(normalized, secret);
    return users.some((user) => clerkUserMatchesEmail(user, normalized)) || users.length > 0;
  } catch {
    return false;
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

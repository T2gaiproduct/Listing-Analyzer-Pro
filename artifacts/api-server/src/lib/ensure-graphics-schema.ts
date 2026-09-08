import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

let migrated = false;

/** Additive columns for graphics_projects (member creator tracking). */
export async function ensureGraphicsProjectsSchemaMigrated(): Promise<void> {
  if (migrated) return;

  await db.execute(sql`ALTER TABLE graphics_projects ADD COLUMN IF NOT EXISTS workspace_id integer`);
  await db.execute(sql`ALTER TABLE graphics_projects ADD COLUMN IF NOT EXISTS created_by_user_id text`);

  migrated = true;
}

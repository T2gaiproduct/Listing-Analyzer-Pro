import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

let migrated = false;

/** Additive schema for sellermate_* tables (production may predate soft-delete columns). */
export async function ensureSellermateSchemaMigrated(): Promise<void> {
  if (migrated) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sellermate_agents (
      id serial PRIMARY KEY,
      workspace_id integer,
      user_id text,
      slug text,
      name text NOT NULL,
      description text NOT NULL DEFAULT '',
      system_prompt text NOT NULL,
      icon text NOT NULL DEFAULT 'sparkles',
      model text NOT NULL DEFAULT 'gpt-5.4',
      status text NOT NULL DEFAULT 'active',
      execution_provider text NOT NULL DEFAULT 'native',
      make_agent_id text,
      is_default integer NOT NULL DEFAULT 0,
      is_deleted integer NOT NULL DEFAULT 0,
      deleted_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS is_default integer NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS is_deleted integer NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS deleted_at timestamp`);
  await db.execute(sql`ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now()`);
  await db.execute(sql`ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS model text DEFAULT 'gpt-5.4'`);
  await db.execute(sql`ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'`);
  await db.execute(sql`ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS execution_provider text DEFAULT 'native'`);
  await db.execute(sql`ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS make_agent_id text`);

  await db.execute(sql`ALTER TABLE sellermate_threads ADD COLUMN IF NOT EXISTS is_deleted integer NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE sellermate_threads ADD COLUMN IF NOT EXISTS deleted_at timestamp`);
  await db.execute(sql`ALTER TABLE sellermate_threads ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now()`);
  await db.execute(sql`ALTER TABLE sellermate_threads ADD COLUMN IF NOT EXISTS external_conversation_id text`);

  await db.execute(sql`ALTER TABLE sellermate_messages ADD COLUMN IF NOT EXISTS is_deleted integer NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE sellermate_messages ADD COLUMN IF NOT EXISTS deleted_at timestamp`);
  await db.execute(sql`ALTER TABLE sellermate_messages ADD COLUMN IF NOT EXISTS metadata text`);

  await db.execute(sql`ALTER TABLE sellermate_memory ADD COLUMN IF NOT EXISTS is_deleted integer NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE sellermate_memory ADD COLUMN IF NOT EXISTS deleted_at timestamp`);
  await db.execute(sql`ALTER TABLE sellermate_memory ADD COLUMN IF NOT EXISTS description text DEFAULT ''`);
  await db.execute(sql`ALTER TABLE sellermate_memory ADD COLUMN IF NOT EXISTS memory_key text`);
  await db.execute(sql`ALTER TABLE sellermate_memory ADD COLUMN IF NOT EXISTS memory_type text DEFAULT 'file'`);

  migrated = true;
}

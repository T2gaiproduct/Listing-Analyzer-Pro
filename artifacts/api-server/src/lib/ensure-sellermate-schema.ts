import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

let agentsMigrated = false;
let fullMigrated = false;

async function createSellermateBaseTables(): Promise<void> {
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

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sellermate_agent_tools (
      id serial PRIMARY KEY,
      agent_id integer NOT NULL REFERENCES sellermate_agents(id) ON DELETE CASCADE,
      workspace_id integer NOT NULL,
      tool_name text NOT NULL,
      enabled integer NOT NULL DEFAULT 1,
      requires_approval integer NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sellermate_threads (
      id serial PRIMARY KEY,
      agent_id integer NOT NULL REFERENCES sellermate_agents(id) ON DELETE CASCADE,
      workspace_id integer NOT NULL,
      user_id text NOT NULL,
      title text NOT NULL DEFAULT 'New chat',
      external_conversation_id text,
      is_deleted integer NOT NULL DEFAULT 0,
      deleted_at timestamp,
      last_message_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sellermate_messages (
      id serial PRIMARY KEY,
      thread_id integer NOT NULL REFERENCES sellermate_threads(id) ON DELETE CASCADE,
      role text NOT NULL,
      content text NOT NULL,
      metadata text,
      is_deleted integer NOT NULL DEFAULT 0,
      deleted_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sellermate_memory (
      id serial PRIMARY KEY,
      agent_id integer NOT NULL REFERENCES sellermate_agents(id) ON DELETE CASCADE,
      workspace_id integer NOT NULL,
      user_id text NOT NULL,
      name text NOT NULL,
      description text NOT NULL DEFAULT '',
      memory_key text,
      memory_type text NOT NULL DEFAULT 'file',
      content text NOT NULL,
      is_deleted integer NOT NULL DEFAULT 0,
      deleted_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
}

async function addAgentsColumns(): Promise<void> {
  await db.execute(sql`ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS is_default integer DEFAULT 0`);
  await db.execute(sql`ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS is_deleted integer DEFAULT 0`);
  await db.execute(sql`ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS deleted_at timestamp`);
  await db.execute(sql`ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()`);
  await db.execute(sql`ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS model text DEFAULT 'gpt-5.4'`);
  await db.execute(sql`ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'`);
  await db.execute(sql`ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS execution_provider text DEFAULT 'native'`);
  await db.execute(sql`ALTER TABLE sellermate_agents ADD COLUMN IF NOT EXISTS make_agent_id text`);
}

async function addOptionalSellermateColumns(): Promise<void> {
  await db.execute(sql`ALTER TABLE sellermate_threads ADD COLUMN IF NOT EXISTS is_deleted integer DEFAULT 0`);
  await db.execute(sql`ALTER TABLE sellermate_threads ADD COLUMN IF NOT EXISTS deleted_at timestamp`);
  await db.execute(sql`ALTER TABLE sellermate_threads ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()`);
  await db.execute(sql`ALTER TABLE sellermate_threads ADD COLUMN IF NOT EXISTS external_conversation_id text`);
  await db.execute(sql`ALTER TABLE sellermate_threads ADD COLUMN IF NOT EXISTS last_message_at timestamp`);

  await db.execute(sql`ALTER TABLE sellermate_messages ADD COLUMN IF NOT EXISTS is_deleted integer DEFAULT 0`);
  await db.execute(sql`ALTER TABLE sellermate_messages ADD COLUMN IF NOT EXISTS deleted_at timestamp`);
  await db.execute(sql`ALTER TABLE sellermate_messages ADD COLUMN IF NOT EXISTS metadata text`);

  await db.execute(sql`ALTER TABLE sellermate_memory ADD COLUMN IF NOT EXISTS is_deleted integer DEFAULT 0`);
  await db.execute(sql`ALTER TABLE sellermate_memory ADD COLUMN IF NOT EXISTS deleted_at timestamp`);
  await db.execute(sql`ALTER TABLE sellermate_memory ADD COLUMN IF NOT EXISTS description text DEFAULT ''`);
  await db.execute(sql`ALTER TABLE sellermate_memory ADD COLUMN IF NOT EXISTS memory_key text`);
  await db.execute(sql`ALTER TABLE sellermate_memory ADD COLUMN IF NOT EXISTS memory_type text DEFAULT 'file'`);
}

/** Minimum schema for default-agent admin save / workspace agent sync. */
export async function ensureSellermateAgentsSchemaMigrated(): Promise<void> {
  if (agentsMigrated) return;
  await createSellermateBaseTables();
  await addAgentsColumns();
  agentsMigrated = true;
}

/** Full sellermate_* additive schema (boot + chat/memory features). */
export async function ensureSellermateSchemaMigrated(): Promise<void> {
  if (fullMigrated) return;
  await ensureSellermateAgentsSchemaMigrated();
  await addOptionalSellermateColumns();
  fullMigrated = true;
}

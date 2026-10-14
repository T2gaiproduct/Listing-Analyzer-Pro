#!/usr/bin/env tsx
/**
 * Generate password_hash for auth_credentials (scrypt format used by native login).
 * Do NOT commit output; run locally and paste hash into SQL once.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx ../../scripts/hash-native-password.ts 'YourPlainPassword'
 */
import { hashPassword } from "../artifacts/api-server/src/lib/native-auth/password.ts";

const plain = process.argv[2];
if (!plain) {
  console.error("Usage: tsx scripts/hash-native-password.ts '<password>'");
  process.exit(1);
}

const hash = await hashPassword(plain);
console.log(hash);

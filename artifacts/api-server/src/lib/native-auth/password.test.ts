import { hashPassword, verifyPassword } from "./password.js";

async function run(): Promise<void> {
  const hash = await hashPassword("DemoAudit!2026");
  if (!(await verifyPassword("DemoAudit!2026", hash))) {
    throw new Error("verify should succeed");
  }
  if (await verifyPassword("wrong", hash)) {
    throw new Error("verify should fail for wrong password");
  }
  console.log("password.test.ts OK");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

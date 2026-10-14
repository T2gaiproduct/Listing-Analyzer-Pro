import { NativeResetPasswordPage } from "@/lib/native-clerk-shim";

/** Native auth password reset (Clerk uses its own reset flow). */
export default function ResetPasswordPage() {
  return <NativeResetPasswordPage />;
}

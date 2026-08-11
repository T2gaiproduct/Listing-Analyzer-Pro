/** Clerk hosted auth copy — uses platform branding instead of legacy "Listing Auditor". */
export function buildClerkLocalization(platformName: string) {
  const app = platformName.trim() || "Seller Lens";

  return {
    signIn: {
      start: {
        title: "Welcome back",
        subtitle: `Sign in to your ${app} account`,
      },
      emailCode: {
        title: "Check your email",
        subtitle: `Enter the verification code sent to your email to continue to ${app}`,
        formTitle: "Verification code",
        resendButton: "Didn't receive a code? Resend",
      },
    },
    signUp: {
      start: {
        title: "Create your account",
        subtitle: `Start optimizing your listings with ${app}`,
      },
      emailCode: {
        title: "Check your email",
        subtitle: `Enter the verification code sent to your email to continue to ${app}`,
        formTitle: "Verification code",
        resendButton: "Didn't receive a code? Resend",
      },
    },
  };
}

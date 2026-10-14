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

/** Native auth UI only (not passed to ClerkProvider localization). */
export function buildNativeForgotPasswordCopy(platformName: string) {
  const app = platformName.trim() || "Seller Lens";
  return {
    requestTitle: "Reset your password",
    requestSubtitle: `Enter your email and we'll send you a reset link for ${app}`,
    sentSubtitle: "If an account exists for that email, we sent a reset link.",
    resetTitle: "Choose a new password",
    resetSubtitle: "Enter the code from your email and a new password",
    forgotLink: "Forgot password?",
  };
}

/** Clerk hosted auth copy — uses platform branding instead of legacy "Listing Auditor". */
export function buildClerkLocalization(platformName: string) {
  const app = platformName.trim() || "Ecommerce Guru";

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
  const app = platformName.trim() || "Ecommerce Guru";
  return {
    requestTitle: "Reset your password",
    requestSubtitle: `Enter your email and we'll send a 6-digit reset code for ${app}`,
    sentSubtitle: "If an account exists for that email, we sent a 6-digit reset code. Copy it from the email subject line (not an older message).",
    resetTitle: "Choose a new password",
    resetSubtitle: "Enter your email, the 6-digit code from your email, and a new password",
    forgotLink: "Forgot password?",
  };
}

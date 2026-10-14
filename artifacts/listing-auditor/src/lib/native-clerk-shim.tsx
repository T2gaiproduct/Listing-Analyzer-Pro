/**
 * Vite alias target for `@clerk/react` when VITE_AUTH_PROVIDER=native.
 * Provides the hooks/components the app expects, backed by /api/auth/* (no Clerk JS).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteLogo } from "@/components/site-logo";
import { useBranding } from "@/hooks/use-branding";
import { buildClerkLocalization } from "@/lib/clerk-localization";
import { cn } from "@/lib/utils";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type NativeUser = {
  id: string;
  primaryEmailAddress: { emailAddress: string } | null;
  emailAddresses: Array<{ emailAddress: string }>;
  fullName: string | null;
  imageUrl: string | null;
  /** Clerk-compatible no-op — profile name is stored via /api/profile. */
  update: (params: { firstName?: string; lastName?: string }) => Promise<void>;
};

function buildNativeUser(userId: string, email: string, fullName: string | null = null): NativeUser {
  return {
    id: userId,
    primaryEmailAddress: email ? { emailAddress: email } : null,
    emailAddresses: email ? [{ emailAddress: email }] : [],
    fullName,
    imageUrl: null,
    update: async (params) => {
      const name = [params.firstName, params.lastName].filter(Boolean).join(" ").trim();
      if (!name) return;
      await fetch(`${basePath}/api/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: name }),
      });
    },
  };
}

type NativeAuthState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: NativeUser | null;
  sessionToken: string | null;
  refreshSession: () => Promise<void>;
  setSession: (payload: { userId: string; email: string; token: string }) => void;
  clearSession: () => void;
  addListener: (handler: (payload: { user: NativeUser | null }) => void) => () => void;
};

const NativeAuthContext = createContext<NativeAuthState | null>(null);

function useNativeAuth(): NativeAuthState {
  const ctx = useContext(NativeAuthContext);
  if (!ctx) throw new Error("NativeAuthContext missing");
  return ctx;
}

async function fetchSession(): Promise<{
  signedIn: boolean;
  userId?: string;
  email?: string | null;
  token?: string;
}> {
  const res = await fetch(`${basePath}/api/auth/session`, { credentials: "include" });
  if (!res.ok) return { signedIn: false };
  return (await res.json()) as {
    signedIn: boolean;
    userId?: string;
    email?: string | null;
  };
}

export function ClerkProvider({
  children,
}: {
  children?: ReactNode;
  publishableKey?: string;
  proxyUrl?: string;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<NativeUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const listenersRef = useRef<Array<(payload: { user: NativeUser | null }) => void>>([]);

  const notify = useCallback((next: NativeUser | null) => {
    for (const fn of listenersRef.current) fn({ user: next });
  }, []);

  const setSession = useCallback(
    (payload: { userId: string; email: string; token: string }) => {
      const next = buildNativeUser(payload.userId, payload.email);
      setUser(next);
      setSessionToken(payload.token);
      notify(next);
    },
    [notify],
  );

  const clearSession = useCallback(() => {
    setUser(null);
    setSessionToken(null);
    notify(null);
  }, [notify]);

  const refreshSession = useCallback(async () => {
    const data = await fetchSession();
    if (data.signedIn && data.userId) {
      const email = data.email ?? "";
      setUser(buildNativeUser(data.userId, email));
      setSessionToken((prev) => prev);
    } else {
      clearSession();
    }
    setIsLoaded(true);
  }, [clearSession]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const addListener = useCallback((handler: (payload: { user: NativeUser | null }) => void) => {
    listenersRef.current.push(handler);
    return () => {
      listenersRef.current = listenersRef.current.filter((h) => h !== handler);
    };
  }, []);

  const value = useMemo(
    () => ({
      isLoaded,
      isSignedIn: !!user,
      user,
      sessionToken,
      refreshSession,
      setSession,
      clearSession,
      addListener,
    }),
    [isLoaded, user, sessionToken, refreshSession, setSession, clearSession, addListener],
  );

  return <NativeAuthContext.Provider value={value}>{children}</NativeAuthContext.Provider>;
}

export function useUser() {
  const { isLoaded, isSignedIn, user } = useNativeAuth();
  return { isLoaded, isSignedIn, user };
}

export function useAuth() {
  const { isLoaded, isSignedIn, sessionToken } = useNativeAuth();
  const getToken = useCallback(async () => sessionToken, [sessionToken]);
  return { isLoaded, isSignedIn, getToken, userId: useNativeAuth().user?.id ?? null };
}

export function useClerk() {
  const { clearSession, addListener, user } = useNativeAuth();

  const signOut = useCallback(
    async (opts?: { redirectUrl?: string }) => {
      await fetch(`${basePath}/api/auth/logout`, { method: "POST", credentials: "include" });
      clearSession();
      window.location.href = opts?.redirectUrl ?? `${basePath}/sign-in`;
    },
    [clearSession],
  );

  return { signOut, addListener, loaded: true, user };
}

export function Show({
  when,
  children,
}: {
  when: "signed-in" | "signed-out";
  children?: ReactNode;
}) {
  const { isLoaded, isSignedIn } = useNativeAuth();
  if (!isLoaded) return null;
  if (when === "signed-in" && isSignedIn) return <>{children}</>;
  if (when === "signed-out" && !isSignedIn) return <>{children}</>;
  return null;
}

export function ClerkLoading({ children }: { children?: ReactNode }) {
  const { isLoaded } = useNativeAuth();
  if (isLoaded) return null;
  return <>{children}</>;
}

export function ClerkLoaded({ children }: { children?: ReactNode }) {
  const { isLoaded } = useNativeAuth();
  if (!isLoaded) return null;
  return <>{children}</>;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AuthOrDivider() {
  return (
    <div className="relative my-6 flex items-center">
      <div className="flex-1 border-t border-slate-200" />
      <span className="px-3 text-xs font-medium text-slate-400">or</span>
      <div className="flex-1 border-t border-slate-200" />
    </div>
  );
}

type AuthStep = "credentials" | "email-code" | "forgot-request" | "forgot-sent" | "forgot-reset";

function AuthFormShell({
  mode,
  signInUrl,
  signUpUrl,
  redirectUrl,
  initialEmail,
  initialResetToken,
  initialStep,
}: {
  mode: "sign-in" | "sign-up";
  signInUrl: string;
  signUpUrl: string;
  redirectUrl: string;
  initialEmail?: string;
  initialResetToken?: string;
  initialStep?: AuthStep;
}) {
  const [, setLocation] = useLocation();
  const { setSession } = useNativeAuth();
  const { platformName } = useBranding();
  const copy = buildClerkLocalization(platformName);
  const forgotCopy = copy.signIn.forgotPassword;
  const [step, setStep] = useState<AuthStep>(initialStep ?? (initialResetToken ? "forgot-reset" : "credentials"));
  const emailCodeCopy = mode === "sign-up" ? copy.signUp.emailCode : copy.signIn.emailCode;
  const heading = (() => {
    if (step === "email-code") return emailCodeCopy.title;
    if (step === "forgot-request") return forgotCopy.requestTitle;
    if (step === "forgot-sent") return forgotCopy.requestTitle;
    if (step === "forgot-reset") return forgotCopy.resetTitle;
    return mode === "sign-up" ? copy.signUp.start.title : copy.signIn.start.title;
  })();
  const subheading = (() => {
    if (step === "email-code") return emailCodeCopy.subtitle;
    if (step === "forgot-request") return forgotCopy.requestSubtitle;
    if (step === "forgot-sent") return forgotCopy.sentSubtitle;
    if (step === "forgot-reset") return forgotCopy.resetSubtitle;
    return mode === "sign-up" ? copy.signUp.start.subtitle : copy.signIn.start.subtitle;
  })();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState(initialResetToken ?? "");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const [devResetHint, setDevResetHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const googleHref = `${basePath}/api/auth/google/start?returnTo=${encodeURIComponent(
    redirectUrl.replace(basePath, "") || "/dashboard",
  )}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const path = mode === "sign-in" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "sign-in" ? { email, password } : { email, password };
      const res = await fetch(`${basePath}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        userId?: string;
        email?: string;
        token?: string;
        needsEmailVerification?: boolean;
        devEmailCode?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      if (data.needsEmailVerification) {
        setStep("email-code");
        setOtp("");
        setDevCodeHint(data.devEmailCode ?? null);
        return;
      }
      if (data.userId && data.email && data.token) {
        setSession({ userId: data.userId, email: data.email, token: data.token });
      }
      setLocation(redirectUrl.replace(basePath, "") || "/dashboard");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${basePath}/api/auth/verify-email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, code: otp }),
      });
      const data = (await res.json()) as { error?: string; userId?: string; email?: string; token?: string };
      if (!res.ok) {
        setError(data.error ?? "Verification failed");
        return;
      }
      if (data.userId && data.email && data.token) {
        setSession({ userId: data.userId, email: data.email, token: data.token });
      }
      setLocation(redirectUrl.replace(basePath, "") || "/dashboard");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function onForgotRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${basePath}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { error?: string; devResetToken?: string; resetUrl?: string };
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      if (data.devResetToken) {
        setDevResetHint(data.devResetToken);
        setResetToken(data.devResetToken);
      }
      setStep("forgot-sent");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function onResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${basePath}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: resetToken.trim(), password }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Could not reset password");
        return;
      }
      setLocation(`${signInUrl.replace(basePath, "")}?reset=success`);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function onResendCode() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${basePath}/api/auth/resend-email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as {
        error?: string;
        devEmailCode?: string;
        needsEmailVerification?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not resend code");
        return;
      }
      if (data.devEmailCode) setDevCodeHint(data.devEmailCode);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="px-8 pb-8 pt-8">
        <div className="mb-6 flex justify-center">
          <SiteLogo imageClassName="h-8 w-auto max-w-[12rem] object-contain" />
        </div>

        <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900">{heading}</h1>
        <p className="mt-2 text-center text-sm text-slate-500">{subheading}</p>

        {step === "forgot-request" ? (
          <form className="mt-6 space-y-4" method="post" action="#" onSubmit={(e) => void onForgotRequest(e)}>
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-sm font-medium text-slate-700">
                Email address
              </Label>
              <Input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-11 border-slate-200 bg-slate-50 text-slate-900"
              />
            </div>
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <Button type="submit" disabled={busy} className="h-11 w-full bg-orange-500 text-white hover:bg-orange-600">
              {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Send reset link"}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
              onClick={() => {
                setStep("credentials");
                setError(null);
              }}
            >
              Back to sign in
            </button>
          </form>
        ) : step === "forgot-sent" ? (
          <div className="mt-6 space-y-4">
            <p className="text-center text-sm text-slate-600">
              Check your inbox for <span className="font-medium text-slate-800">{email}</span>.
            </p>
            {devResetHint && import.meta.env.DEV && (
              <p className="text-center text-xs text-amber-700">Dev reset token: {devResetHint}</p>
            )}
            <Button
              type="button"
              className="h-11 w-full bg-orange-500 text-white hover:bg-orange-600"
              onClick={() => setStep("forgot-reset")}
            >
              Enter reset code
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
              onClick={() => setStep("credentials")}
            >
              Back to sign in
            </button>
          </div>
        ) : step === "forgot-reset" ? (
          <form className="mt-6 space-y-4" method="post" action="#" onSubmit={(e) => void onResetPassword(e)}>
            <div className="space-y-2">
              <Label htmlFor="reset-token" className="text-sm font-medium text-slate-700">
                Reset code
              </Label>
              <Input
                id="reset-token"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Paste the code from your email"
                className="h-11 border-slate-200 bg-slate-50 font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-medium text-slate-700">
                New password
              </Label>
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="h-11 border-slate-200 bg-slate-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-medium text-slate-700">
                Confirm password
              </Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="h-11 border-slate-200 bg-slate-50"
              />
            </div>
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <Button type="submit" disabled={busy} className="h-11 w-full bg-orange-500 text-white hover:bg-orange-600">
              {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Update password"}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
              onClick={() => setStep("forgot-request")}
            >
              Request a new link
            </button>
          </form>
        ) : step === "email-code" ? (
          <form className="mt-6 space-y-4" onSubmit={(e) => void onVerifyCode(e)}>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{emailCodeCopy.formTitle}</Label>
              <p className="text-xs text-slate-500">
                Sent to <span className="font-medium text-slate-700">{email}</span>
              </p>
              <div className="flex justify-center pt-2">
                <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={busy}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="h-11 w-11 border-slate-200 bg-slate-50 text-base text-slate-900 first:rounded-lg last:rounded-lg"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {devCodeHint && import.meta.env.DEV && (
                <p className="text-center text-xs text-amber-700">Dev code: {devCodeHint}</p>
              )}
            </div>
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <Button
              type="submit"
              disabled={busy || otp.length < 6}
              className="h-11 w-full bg-orange-500 text-base font-semibold text-white hover:bg-orange-600"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Please wait…
                </>
              ) : (
                "Continue"
              )}
            </Button>
            <button
              type="button"
              disabled={busy}
              className="w-full text-center text-sm font-medium text-orange-500 hover:text-orange-600 disabled:opacity-50"
              onClick={() => void onResendCode()}
            >
              {emailCodeCopy.resendButton}
            </button>
            <button
              type="button"
              className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
              onClick={() => {
                setStep("credentials");
                setOtp("");
                setError(null);
              }}
            >
              Use a different email
            </button>
          </form>
        ) : (
          <>
        <a
          href={googleHref}
          className={cn(
            "mt-6 flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-slate-200",
            "bg-white text-sm font-medium text-slate-700 shadow-none transition-colors hover:bg-slate-50",
          )}
        >
          <GoogleIcon className="h-5 w-5 shrink-0" />
          Continue with Google
        </a>

        <AuthOrDivider />

        <form className="space-y-4" method="post" action="#" onSubmit={(e) => void onSubmit(e)}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="h-11 border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-slate-700">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                placeholder={mode === "sign-up" ? "Create a password" : "Enter your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                className="h-11 border-slate-200 bg-slate-50 pr-10 text-slate-900 placeholder:text-slate-400"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm font-medium text-orange-500 hover:text-orange-600"
                onClick={() => {
                  setStep("forgot-request");
                  setError(null);
                }}
              >
                {forgotCopy.forgotLink}
              </button>
            </div>
          </div>
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <Button
            type="submit"
            disabled={busy}
            className="h-11 w-full bg-orange-500 text-base font-semibold text-white hover:bg-orange-600"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait…
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="ml-1 h-4 w-4" strokeWidth={2.5} />
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
          {mode === "sign-in" ? (
            <>
              Don&apos;t have an account?{" "}
              <Link href={signUpUrl.replace(basePath, "")} className="font-semibold text-orange-500 hover:text-orange-600">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href={signInUrl.replace(basePath, "")} className="font-semibold text-orange-500 hover:text-orange-600">
                Sign in
              </Link>
            </>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SignIn(props: {
  signUpUrl?: string;
  fallbackRedirectUrl?: string;
  forceRedirectUrl?: string;
  initialValues?: { emailAddress?: string };
}) {
  const redirectUrl = props.forceRedirectUrl ?? props.fallbackRedirectUrl ?? `${basePath}/dashboard`;
  const signUpUrl = props.signUpUrl ?? `${basePath}/sign-up`;
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  return (
    <AuthFormShell
      mode="sign-in"
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={signUpUrl}
      redirectUrl={redirectUrl}
      initialEmail={props.initialValues?.emailAddress}
      initialStep={search?.get("forgot") === "1" ? "forgot-request" : undefined}
    />
  );
}

/** Standalone reset page (email link: /reset-password?token=...) */
export function NativeResetPasswordPage() {
  const token =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token")?.trim() ?? "" : "";
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <AuthFormShell
        mode="sign-in"
        signInUrl={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        redirectUrl={`${basePath}/dashboard`}
        initialResetToken={token}
        initialStep={token ? "forgot-reset" : "forgot-request"}
      />
    </div>
  );
}

export function SignUp(props: { signInUrl?: string; fallbackRedirectUrl?: string; forceRedirectUrl?: string }) {
  const redirectUrl = props.forceRedirectUrl ?? props.fallbackRedirectUrl ?? `${basePath}/dashboard`;
  const signInUrl = props.signInUrl ?? `${basePath}/sign-in`;
  return (
    <AuthFormShell
      mode="sign-up"
      signInUrl={signInUrl}
      signUpUrl={`${basePath}/sign-up`}
      redirectUrl={redirectUrl}
    />
  );
}

export function AuthenticateWithRedirectCallback() {
  return (
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      <p className="text-sm text-slate-600">Completing sign-in…</p>
    </div>
  );
}

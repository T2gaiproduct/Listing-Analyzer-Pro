import { useState, useMemo } from "react";
import { useSignUp } from "@clerk/react/legacy";
import { Link } from "wouter";
import { Eye, EyeOff, Check, X } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Requirement {
  label: string;
  test: (pw: string) => boolean;
}

const REQUIREMENTS: Requirement[] = [
  { label: "At least 8 characters",               test: (pw) => pw.length >= 8 },
  { label: "Under 72 characters",                  test: (pw) => pw.length > 0 && pw.length <= 72 },
  { label: "One uppercase letter (A–Z)",           test: (pw) => /[A-Z]/.test(pw) },
  { label: "One lowercase letter (a–z)",           test: (pw) => /[a-z]/.test(pw) },
  { label: "One number (0–9)",                     test: (pw) => /[0-9]/.test(pw) },
  { label: "One special character (!@#$%^&*…)",    test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

function isValid(pw: string) {
  return REQUIREMENTS.every((r) => r.test(pw));
}

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();

  const postAuthPath = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect_url");
    if (redirect && redirect.startsWith("/")) return redirect;
    if (redirect && redirect.startsWith(basePath)) return redirect.slice(basePath.length) || "/";
    return `${basePath}/onboarding`;
  }, []);

  const [step, setStep] = useState<"form" | "verify">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwTouched, setPwTouched] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [socialLoading, setSocialLoading] = useState(false);

  const requirements = REQUIREMENTS.map((r) => ({ ...r, met: r.test(password) }));
  const passwordValid = isValid(password);
  const showPanel = pwTouched && password.length > 0;
  const redOutline = showPanel && !passwordValid;
  const greenOutline = password.length > 0 && passwordValid;

  async function handleGoogleSignUp() {
    if (!isLoaded) return;
    setSocialLoading(true);
    setError("");
    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${window.location.origin}${basePath}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}${postAuthPath}`,
      });
    } catch (err: unknown) {
      const e = err as { errors?: Array<{ longMessage?: string; message?: string }> };
      const first = e?.errors?.[0];
      setError(first?.longMessage ?? first?.message ?? "Google sign-up failed.");
      setSocialLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !passwordValid) return;
    setLoading(true);
    setError("");
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err: unknown) {
      const e = err as { errors?: Array<{ longMessage?: string; message?: string }> };
      const first = e?.errors?.[0];
      setError(first?.longMessage ?? first?.message ?? "Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        window.location.href = postAuthPath;
      }
    } catch (err: unknown) {
      const e = err as { errors?: Array<{ longMessage?: string; message?: string }> };
      const first = e?.errors?.[0];
      setError(first?.longMessage ?? first?.message ?? "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">

          {/* Header */}
          <div className="px-8 pt-8 pb-5 text-center">
            <a href={basePath || "/"}>
              <img
                src={`${window.location.origin}${basePath}/logo.svg`}
                alt="ListingAuditor"
                className="h-8 w-auto mx-auto mb-5"
              />
            </a>
            {step === "form" ? (
              <>
                <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
                <p className="text-slate-500 text-sm mt-1">Start auditing your Amazon listings today</p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-slate-900">Check your email</h1>
                <p className="text-slate-500 text-sm mt-1">
                  We sent a 6-digit code to{" "}
                  <span className="font-semibold text-slate-700">{email}</span>
                </p>
              </>
            )}
          </div>

          <div className="px-8 pb-8">
            {step === "form" ? (
              <>
                {/* Google */}
                <button
                  type="button"
                  onClick={handleGoogleSignUp}
                  disabled={socialLoading || !isLoaded}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-5"
                >
                  {socialLoading ? (
                    <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 font-medium">or continue with email</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors"
                      placeholder="jane@example.com"
                      required
                      autoComplete="email"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Password</label>
                    <div className="relative">
                      <input
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setPwTouched(true)}
                        className={`w-full px-3 py-2.5 pr-10 text-sm rounded-lg bg-slate-50 border text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all duration-150 ${
                          redOutline
                            ? "border-red-400 ring-2 ring-red-300/40"
                            : greenOutline
                            ? "border-green-400 ring-2 ring-green-300/40"
                            : "border-slate-200 focus:ring-orange-500/30 focus:border-orange-500"
                        }`}
                        placeholder="Create a strong password"
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        onClick={() => setShowPw((v) => !v)}
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Requirements panel */}
                    {showPanel && (
                      <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-1 gap-1.5">
                        {requirements.map((req) => (
                          <div
                            key={req.label}
                            className={`flex items-center gap-2 text-xs transition-colors duration-150 ${
                              req.met ? "text-green-700" : "text-slate-500"
                            }`}
                          >
                            <span
                              className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-150 ${
                                req.met
                                  ? "bg-green-100 text-green-600"
                                  : "bg-slate-200 text-slate-400"
                              }`}
                            >
                              {req.met ? (
                                <Check className="w-2.5 h-2.5" strokeWidth={3} />
                              ) : (
                                <X className="w-2.5 h-2.5" strokeWidth={3} />
                              )}
                            </span>
                            {req.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !isLoaded || !passwordValid}
                    className="w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors mt-1"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Creating account…
                      </span>
                    ) : (
                      "Create account"
                    )}
                  </button>
                </form>
              </>
            ) : (
              /* Verification step */
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Verification code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full px-3 py-3 text-sm rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-center tracking-[0.5em] text-xl font-mono placeholder:text-slate-300 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors"
                    placeholder="000000"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                  <p className="text-xs text-slate-400">Didn't get it? Check your spam folder.</p>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Verifying…
                    </span>
                  ) : (
                    "Verify email"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("form"); setError(""); setCode(""); }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors py-1"
                >
                  ← Back to sign up
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50 px-8 py-4 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-orange-500 hover:text-orange-600 font-semibold transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

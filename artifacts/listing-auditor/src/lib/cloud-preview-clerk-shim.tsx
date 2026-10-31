/**
 * Minimal `@clerk/react` stand-in for Cloudflare quick-tunnel testing when Clerk sign-in is blocked.
 * Auto-calls POST /api/cloud-preview/session and uses Bearer cpt_* tokens for /api calls.
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
import { Loader2 } from "lucide-react";
import { isCloudflareQuickPreviewHost } from "@/lib/cloudflare-preview";
import { getStoredPreviewPersona, type CloudPreviewPersona } from "@/lib/cloud-preview-persona";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type PreviewUser = {
  id: string;
  primaryEmailAddress: { emailAddress: string } | null;
  emailAddresses: Array<{ emailAddress: string }>;
  fullName: string | null;
  imageUrl: string | null;
  update: (params: { firstName?: string; lastName?: string }) => Promise<void>;
};

const adminUserIdsEnv = (import.meta.env.VITE_ADMIN_USER_IDS as string | undefined ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function buildUser(userId: string, email: string, persona: CloudPreviewPersona): PreviewUser {
  const isAdminPersona = persona === "admin" || adminUserIdsEnv.includes(userId);
  return {
    id: userId,
    primaryEmailAddress: { emailAddress: email },
    emailAddresses: [{ emailAddress: email }],
    fullName: isAdminPersona ? "Preview admin" : "Demo customer",
    imageUrl: null,
    update: async () => {},
  };
}

type PreviewAuthState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: PreviewUser | null;
  sessionToken: string | null;
  addListener: (handler: (payload: { user: PreviewUser | null }) => void) => () => void;
};

const PreviewAuthContext = createContext<PreviewAuthState | null>(null);

function usePreviewAuth(): PreviewAuthState {
  const ctx = useContext(PreviewAuthContext);
  if (!ctx) throw new Error("PreviewAuthContext missing");
  return ctx;
}

async function bootstrapPreviewSession(): Promise<{
  userId: string;
  email: string;
  token: string;
  persona: CloudPreviewPersona;
} | null> {
  if (!isCloudflareQuickPreviewHost()) return null;
  const persona = getStoredPreviewPersona();
  const res = await fetch(`${basePath}/api/cloud-preview/session`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona }),
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    userId: string;
    email: string;
    token: string;
    persona: CloudPreviewPersona;
  };
}

export function ClerkProvider({ children }: { children?: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<PreviewUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const listenersRef = useRef<Array<(payload: { user: PreviewUser | null }) => void>>([]);

  const notify = useCallback((next: PreviewUser | null) => {
    for (const fn of listenersRef.current) fn({ user: next });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await bootstrapPreviewSession();
      if (cancelled) return;
      if (data?.userId && data.token) {
        const persona = data.persona ?? getStoredPreviewPersona();
        const next = buildUser(data.userId, data.email, persona);
        setUser(next);
        setSessionToken(data.token);
        notify(next);
      }
      setIsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [notify]);

  const addListener = useCallback((handler: (payload: { user: PreviewUser | null }) => void) => {
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
      addListener,
    }),
    [isLoaded, user, sessionToken, addListener],
  );

  return <PreviewAuthContext.Provider value={value}>{children}</PreviewAuthContext.Provider>;
}

export function useUser() {
  const { isLoaded, user } = usePreviewAuth();
  return { isLoaded, isSignedIn: !!user, user };
}

export function useAuth() {
  const { isLoaded, isSignedIn, sessionToken } = usePreviewAuth();
  return {
    isLoaded,
    isSignedIn,
    getToken: async () => sessionToken,
  };
}

export function useClerk() {
  const { addListener } = usePreviewAuth();
  return {
    addListener,
    signOut: async () => {
      window.location.href = previewLandingPath;
    },
  };
}

export function Show({
  when,
  children,
}: {
  when: "signed-in" | "signed-out";
  children?: ReactNode;
}) {
  const { isSignedIn } = usePreviewAuth();
  if (when === "signed-in" && isSignedIn) return <>{children}</>;
  if (when === "signed-out" && !isSignedIn) return <>{children}</>;
  return null;
}

export function ClerkLoading({ children }: { children?: ReactNode }) {
  const { isLoaded } = usePreviewAuth();
  if (isLoaded) return null;
  return (
    children ?? (
      <div className="flex flex-col items-center gap-3 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <p className="text-sm text-slate-600">Starting preview session…</p>
      </div>
    )
  );
}

export function ClerkLoaded({ children }: { children?: ReactNode }) {
  const { isLoaded } = usePreviewAuth();
  if (!isLoaded) return null;
  return <>{children}</>;
}

export function ClerkFailed({ children }: { children?: ReactNode }) {
  const { isLoaded, isSignedIn } = usePreviewAuth();
  if (!isLoaded || isSignedIn) return null;
  return (
    children ?? (
      <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-950">
        <p className="font-semibold">Preview auto sign-in failed</p>
        <p className="mt-2">
          Ensure <span className="font-mono text-xs">ADMIN_USER_IDS</span> is set and dev-stack was restarted with a
          quick Cloudflare tunnel.
        </p>
      </div>
    )
  );
}

function PreviewRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  );
}

const previewLandingPath = `${basePath}/dashboard`;

export function SignIn(props: { fallbackRedirectUrl?: string; forceRedirectUrl?: string }) {
  const redirectUrl = props.forceRedirectUrl ?? props.fallbackRedirectUrl ?? previewLandingPath;
  const { isSignedIn, isLoaded } = usePreviewAuth();
  if (isLoaded && isSignedIn) return <PreviewRedirect to={redirectUrl} />;
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 px-4 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      <p className="text-sm text-slate-600">Cloud preview: signing you in for testing (no Clerk)…</p>
    </div>
  );
}

export function SignUp(props: { fallbackRedirectUrl?: string; forceRedirectUrl?: string }) {
  const redirectUrl = props.forceRedirectUrl ?? props.fallbackRedirectUrl ?? `${basePath}/dashboard`;
  return <PreviewRedirect to={redirectUrl} />;
}

export function AuthenticateWithRedirectCallback() {
  return <PreviewRedirect to={`${basePath}/dashboard`} />;
}

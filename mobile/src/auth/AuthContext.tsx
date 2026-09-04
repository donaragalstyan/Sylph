import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { getStoredTokens } from "./tokenStorage";
import { fetchMe, signOutRemote, signInDev, type SylphUser } from "./api";
import { signInWithApple as appleSignIn } from "./appleSignIn";
import { signInWithGoogle as googleSignIn } from "./googleSignIn";
import { setSessionExpiredHandler } from "../api/client";

type AuthStatus = "loading" | "signedOut" | "signedIn";

interface AuthContextValue {
  status: AuthStatus;
  user: SylphUser | null;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithDevAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<SylphUser | null>(null);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus("signedOut");
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const tokens = await getStoredTokens();
        if (!tokens) {
          setStatus("signedOut");
          return;
        }
        const me = await fetchMe();
        setUser(me);
        setStatus("signedIn");
      } catch {
        // Covers both "couldn't read secure storage" and "stored session no longer valid" —
        // either way there's no usable session, so fail open to signed-out rather than leaving
        // status stuck at "loading" (and the splash screen up) forever.
        setStatus("signedOut");
      }
    })();
  }, []);

  async function afterSignIn() {
    const me = await fetchMe();
    setUser(me);
    setStatus("signedIn");
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signInWithApple: async () => {
        await appleSignIn();
        await afterSignIn();
      },
      signInWithGoogle: async () => {
        await googleSignIn();
        await afterSignIn();
      },
      signInWithDevAccount: async () => {
        await signInDev("Dev Tester");
        await afterSignIn();
      },
      signOut: async () => {
        await signOutRemote();
        setUser(null);
        setStatus("signedOut");
      },
      refreshUser: async () => {
        const me = await fetchMe();
        setUser(me);
      },
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

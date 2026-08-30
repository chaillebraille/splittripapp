import { supabase } from "@/integrations/supabase/client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type AuthContextValue = {
  isReady: boolean;
  userId: string | null;
};

const AuthContext = createContext<AuthContextValue>({ isReady: false, userId: null });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function ensureSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        if (!cancelled) {
          setUserId(session.user.id);
          setIsReady(true);
        }
        return;
      }

      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error("Anonymous sign-in failed:", error);
      }
      if (!cancelled) {
        setUserId(data.session?.user?.id ?? null);
        setIsReady(true);
      }
    }

    ensureSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={{ isReady, userId }}>{children}</AuthContext.Provider>;
}

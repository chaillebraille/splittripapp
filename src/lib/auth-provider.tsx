import { supabase } from "@/integrations/supabase/client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { switchUser } from "@/lib/local/store";
import { setSyncEnabled } from "@/lib/local/sync";

type AuthContextValue = {
  isReady: boolean;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  isReady: false,
  userId: null,
  email: null,
  displayName: null,
  isAdmin: false,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function applyUser(
      id: string | null,
      userEmail: string | null,
      name: string | null,
    ) {
      // Swap the per-user local dataset before anything reads it.
      await switchUser(id);
      setSyncEnabled(id !== null);
      if (cancelled) return;
      setUserId(id);
      setEmail(userEmail);
      setDisplayName(name);
      if (id) {
        const { data } = await supabase.rpc("has_role", { _user_id: id, _role: "admin" });
        if (!cancelled) setIsAdmin(Boolean(data));
      } else {
        setIsAdmin(false);
      }
      if (!cancelled) setIsReady(true);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      void applyUser(
        session?.user?.id ?? null,
        session?.user?.email ?? null,
        (session?.user?.user_metadata?.display_name as string | undefined) ?? null,
      );
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void applyUser(
        session?.user?.id ?? null,
        session?.user?.email ?? null,
        (session?.user?.user_metadata?.display_name as string | undefined) ?? null,
      );
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ isReady, userId, email, displayName, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

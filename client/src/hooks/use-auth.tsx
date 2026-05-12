import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  readAdminCaptureUxEnabledFromStorage,
  writeAdminCaptureUxEnabledToStorage,
} from "@/lib/admin-capture-preferences";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "user" | "admin";
  is_subscriber: boolean;
  has_accepted_terms: boolean;
  has_completed_onboarding: boolean;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  /**
   * Pause capture + aplatis PNG + HUD debug lorsque vous êtes admin et que l’option
   * correspondante reste activée en paramètres (localStorage).
   */
  adminCaptureExtrasActive: boolean;
  setAdminCaptureUxEnabled: (enabled: boolean) => void;
  /**
   * Effective gate for paid/premium features.
   * Mirrors `scoremax_has_premium_access(uid)` server-side: admin OR active sub.
   */
  hasPremiumAccess: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [adminCaptureUxEnabled, setAdminCaptureUxEnabledState] = useState(() =>
    typeof window !== "undefined" ? readAdminCaptureUxEnabledFromStorage() : true,
  );
  const { toast } = useToast();

  /** Re-sync si plusieurs onglets : rare pour ce toggle, mais cohérent après navigation. */
  useEffect(() => {
    const onFocus = () => {
      try {
        setAdminCaptureUxEnabledState(readAdminCaptureUxEnabledFromStorage());
      } catch {
        /* */
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const setAdminCaptureUxEnabled = useCallback((enabled: boolean) => {
    setAdminCaptureUxEnabledState(enabled);
    writeAdminCaptureUxEnabledToStorage(enabled);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoadingSession(false);

        if (event === "SIGNED_OUT") {
          queryClient.clear();
        }

        if (session?.user) {
          // Update last active timestamp
          supabase
            .from("profiles")
            .update({ last_active_at: new Date().toISOString() })
            .eq("id", session.user.id)
            .then(({ error }) => {
              if (error) console.error("Error updating last active:", error);
            });
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  const { data: profile, isLoading: isLoadingProfile } =
    useQuery<Profile | null>({
      queryKey: ["profile", user?.id],
      queryFn: async () => {
        if (!user) return null;
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.warn("Profile fetch failed.", error);
          throw error;
        }

        if (data === null) {
          // JWT encore valide côté client mais plus de ligne (ex. utilisateur supprimé côté serveur).
          await supabase.auth.signOut();
          queryClient.clear();
          return null;
        }

        return data as Profile;
      },
      enabled: !!user,
      retry: 2,
      retryDelay: 400,
      staleTime: 0,
    });

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Error signing out",
        description: error.message,
      });
    }
  };

  const isAdmin = profile?.role === "admin";
  const adminCaptureExtrasActive = isAdmin && adminCaptureUxEnabled;
  const value = {
    session,
    user,
    profile: profile ?? null,
    isLoading: isLoadingSession || (!!user && isLoadingProfile),
    isAdmin,
    adminCaptureExtrasActive,
    setAdminCaptureUxEnabled,
    hasPremiumAccess: isAdmin || Boolean(profile?.is_subscriber),
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

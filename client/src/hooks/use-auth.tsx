import {
  createContext,
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
import { AUTH_CONFIG } from "@/config/auth";

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
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const { toast } = useToast();

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
          window.location.href = AUTH_CONFIG.LOGIN_PATH;
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
        const queryKey = ["profile", user.id] as const;
        const cachedProfile =
          queryClient.getQueryData<Profile>(queryKey) ?? null;

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) {
          console.warn(
            "Profile fetch failed, using cached profile if available.",
            error,
          );
          return cachedProfile;
        }

        console.log("Profile fetched:", data); // Debug log
        return data as Profile;
      },
      enabled: !!user,
      retry: 2,
      retryDelay: 400,
      staleTime: 0, // Ensure we get fresh data
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

  const value = {
    session,
    user,
    profile: profile ?? null,
    isLoading: isLoadingSession || (!!user && isLoadingProfile),
    isAdmin: profile?.role === "admin",
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

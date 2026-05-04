import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { WaveBackground } from "@/components/background/WaveBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { SiApple, SiGoogle } from "react-icons/si";
import { translateSupabaseError } from "@/lib/error-translator";
import {
  authOAuthButtonClassName,
  authPrimarySubmitClassName,
} from "@/lib/auth-button-styles";
import {
  authPageCardClassName,
  authPageOverlayClassName,
} from "@/lib/auth-page-shell-styles";
import { i18n, useAppLanguage } from "@/lib/i18n";

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const language = useAppLanguage();

  const isLogin = location === "/login";

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "", color: "bg-muted" };
    if (pass.length < 6) return { score: 1, label: "Trop court", color: "bg-destructive" };

    let score = 1;
    if (pass.length > 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { score: 2, label: "Faible", color: "bg-orange-500" };
    if (score <= 3) return { score: 3, label: "Moyenne", color: "bg-yellow-500" };
    if (score <= 4) return { score: 4, label: "Forte", color: "bg-green-500" };
    return { score: 5, label: "Excellente", color: "bg-emerald-600" };
  };

  const strength = getPasswordStrength(password);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({ title: "Bon retour !", description: "Connexion réussie." });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: {
              has_accepted_terms: true,
            },
          },
        });
        if (error) throw error;
        toast({
          title: "Compte créé",
          description: "Veuillez vérifier vos emails pour confirmer votre inscription.",
        });
        setLocation("/login");
      }
    } catch (error: any) {
      const translated = translateSupabaseError(error);
      toast({
        variant: "destructive",
        title: translated.title,
        description: translated.description,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "apple" | "google") => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/onboarding`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      const translated = translateSupabaseError(error);
      toast({
        variant: "destructive",
        title: translated.title,
        description: translated.description,
      });
      setIsLoading(false);
    }
  };

  return (
    <main className="relative isolate flex min-h-[100svh] items-center overflow-x-hidden px-4 py-5 text-white sm:py-6">
      <WaveBackground position="fixed" className="z-0" />
      <div className={authPageOverlayClassName} aria-hidden />

      <div className="relative z-10 mx-auto w-full min-w-0 max-w-md">
        <section className={authPageCardClassName}>
          <div className="min-w-0 space-y-1.5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400 sm:text-xs">
              {i18n(language, {
                en: isLogin ? "Sign in" : "Sign up",
                fr: isLogin ? "Connexion" : "Inscription",
              })}
            </p>
            <h1 className="mx-auto max-w-full text-pretty text-[clamp(1.3rem,4.2vw+0.35rem,2.125rem)] font-hero font-semibold leading-[1.08] tracking-[-0.015em] text-white">
              {i18n(language, {
                en: isLogin ? "Welcome back" : "Create your account",
                fr: isLogin ? "Bon retour" : "Créer ton compte",
              })}
            </h1>
            <p className="text-pretty text-sm leading-snug text-zinc-400">
              {i18n(language, {
                en: isLogin
                  ? "Sign in to ScoreMax and pick up your analysis where you left off."
                  : "Start your first analysis and get your personalized improvement plan.",
                fr: isLogin
                  ? "Accède à ton espace ScoreMax et reprends ton analyse là où tu l'as laissée."
                  : "Lance ta première analyse et découvre tes axes d'amélioration personnalisés.",
              })}
            </p>
          </div>

          <div className="mt-4 space-y-3 sm:mt-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                className={authOAuthButtonClassName}
                onClick={() => handleOAuthSignIn("google")}
                disabled={isLoading}
                data-testid="button-google-auth"
              >
                <SiGoogle className="mr-2 h-5 w-5" />
                Google
              </Button>
              <Button
                type="button"
                className={authOAuthButtonClassName}
                onClick={() => handleOAuthSignIn("apple")}
                disabled={isLoading}
                data-testid="button-apple-auth"
              >
                <SiApple className="mr-2 h-5 w-5" />
                Apple
              </Button>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500 sm:text-xs">
              <div className="h-px flex-1 bg-white/15" />
              {i18n(language, {
                en: "Or with email",
                fr: "Ou par email",
              })}
              <div className="h-px flex-1 bg-white/15" />
            </div>

            <form onSubmit={handleAuth} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-zinc-300">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nom@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-2xl border-white/15 bg-white/[0.06] px-4 text-white placeholder:text-zinc-500 focus-visible:ring-white/25"
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-zinc-300">
                  {i18n(language, { en: "Password", fr: "Mot de passe" })}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 rounded-2xl border-white/15 bg-white/[0.06] px-4 pr-12 text-white focus-visible:ring-white/25"
                    data-testid="input-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-zinc-400 hover:bg-white/10 hover:text-white no-default-hover-elevate no-default-active-elevate"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {!isLogin && password ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">
                        {i18n(language, { en: "Strength", fr: "Robustesse" })}
                      </span>
                      <span className="font-semibold text-zinc-200">{strength.label}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full transition-all duration-300 ${strength.color}`}
                        style={{ width: `${(strength.score / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <Button
                type="submit"
                className={authPrimarySubmitClassName}
                disabled={isLoading}
                data-testid="button-auth-submit"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {i18n(language, {
                  en: isLogin ? "Sign in" : "Sign up",
                  fr: isLogin ? "Se connecter" : "S'inscrire",
                })}
                {!isLoading ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
              </Button>
            </form>
          </div>

          <p className="mt-4 text-center text-sm text-zinc-500">
            {i18n(language, {
              en: isLogin ? "No account yet?" : "Already have an account?",
              fr: isLogin ? "Pas encore de compte ?" : "Déjà un compte ?",
            })}{" "}
            <button
              type="button"
              onClick={() => setLocation(isLogin ? "/register" : "/login")}
              className="font-semibold text-white underline-offset-4 hover:underline"
            >
              {i18n(language, {
                en: isLogin ? "Sign up" : "Sign in",
                fr: isLogin ? "S'inscrire" : "Se connecter",
              })}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}

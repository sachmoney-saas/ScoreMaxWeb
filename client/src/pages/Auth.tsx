import { useState } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { translateSupabaseError } from "@/lib/error-translator";

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
            emailRedirectTo: `${window.location.origin}/app`,
            data: {
              has_accepted_terms: true
            }
          }
        });
        if (error) throw error;
        toast({ title: "Compte créé", description: "Veuillez vérifier vos emails pour confirmer votre inscription." });
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

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/app`,
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
    <main className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] px-4 py-4 text-white">
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#b9ccd1]/20 blur-3xl" />

      <div className="relative mx-auto w-full max-w-md">
        <section className="max-h-[calc(100svh-2rem)] overflow-hidden rounded-[2rem] border border-white/70 bg-[#f1f1f1] p-3 text-[#111827] shadow-[0_45px_120px_-80px_rgba(0,0,0,0.98)]">
          <div className="rounded-[1.5rem] border border-black/10 bg-white p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-7">
            <div className="space-y-2 text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {isLogin ? "Connexion" : "Inscription"}
              </p>
              <h2 className="font-display text-4xl font-bold tracking-tight text-[#111827]">
                {isLogin ? "Bon retour" : "Créer ton compte"}
              </h2>
              <p className="text-sm leading-relaxed text-zinc-500">
                {isLogin
                  ? "Accède à ton espace ScoreMax et reprends ton analyse là où tu l'as laissée."
                  : "Lance ta première analyse et découvre tes axes d'amélioration personnalisés."}
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-2xl border-black/10 bg-white text-base font-semibold text-[#111827] shadow-none hover:bg-[#f7f7f7]"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                data-testid="button-google-auth"
              >
                <SiGoogle className="mr-2 h-5 w-5" />
                {isLogin ? "Se connecter avec Google" : "S'inscrire avec Google"}
              </Button>

              <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
                <div className="h-px flex-1 bg-black/10" />
                ou par email
                <div className="h-px flex-1 bg-black/10" />
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-[#111827]">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nom@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 rounded-2xl border-black/10 bg-[#f7f7f7] px-4 text-[#111827] placeholder:text-zinc-400 focus-visible:ring-black/20"
                    data-testid="input-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-[#111827]">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-12 rounded-2xl border-black/10 bg-[#f7f7f7] px-4 pr-12 text-[#111827] focus-visible:ring-black/20"
                      data-testid="input-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-zinc-500 hover:bg-black/5 hover:text-[#111827] no-default-hover-elevate no-default-active-elevate"
                      onClick={() => setShowPassword(!showPassword)}
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {!isLogin && password ? (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500">Robustesse</span>
                        <span className="font-semibold text-[#111827]">{strength.label}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
                        <div
                          className={`h-full transition-all duration-300 ${strength.color}`}
                          style={ { width: `${(strength.score / 5) * 100}%` } }
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl bg-[#111827] text-base font-semibold text-white shadow-[0_24px_60px_-38px_rgba(0,0,0,0.95)] hover:bg-black"
                  disabled={isLoading}
                  data-testid="button-auth-submit"
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLogin ? "Se connecter" : "S'inscrire"}
                  {!isLoading ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                </Button>
              </form>
            </div>

            <p className="mt-5 text-center text-sm text-zinc-500">
              {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
              <button
                type="button"
                onClick={() => setLocation(isLogin ? "/register" : "/login")}
                className="font-semibold text-[#111827] underline-offset-4 hover:underline"
              >
                {isLogin ? "S'inscrire" : "Se connecter"}
              </button>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

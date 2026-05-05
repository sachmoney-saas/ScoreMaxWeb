import * as React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { primaryCtaSurfaceClassName } from "@/lib/cta-button-styles";
import { i18n, type AppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function FloatingHeader({ language }: { language: AppLanguage }) {
  const { user } = useAuth();
  const [hasScrolled, setHasScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => {
      setHasScrolled(window.scrollY > 16);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className={`pointer-events-auto flex items-center justify-between px-6 py-3 rounded-full w-full lg:max-w-[75%] border transition-all duration-300 ${
          hasScrolled
            ? "glass border-border/60"
            : "border-transparent bg-transparent shadow-none"
        }`}
      >
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 pointer-events-auto cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="bg-primary/10 p-1.5 rounded-lg">
              <img
                src="/favicon.png"
                alt="ScoreMax favicon"
                className="h-4 w-4 object-contain"
              />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">
              Score
              <span className="text-[#d6e4ff]">Max</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <Link href="/app">
              <Button
                size="sm"
                className={cn("px-5 text-sm", primaryCtaSurfaceClassName)}
              >
                {i18n(language, { en: "My Account", fr: "Mon compte" })}
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full hidden sm:flex"
                >
                  {i18n(language, { en: "Login", fr: "Connexion" })}
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="sm"
                  className="rounded-sm px-6 shadow-lg shadow-primary/20"
                >
                  {i18n(language, { en: "Get Started", fr: "Démarrer" })}
                </Button>
              </Link>
            </>
          )}
        </div>
      </motion.header>
    </div>
  );
}

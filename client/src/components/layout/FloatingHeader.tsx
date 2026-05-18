import * as React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { primaryCtaSurfaceClassName } from "@/lib/cta-button-styles";
import { i18n, useLanguage, type AppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function FlagFr({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 3 2"
      aria-hidden
      className={cn(
        "h-[14px] w-[21px] shrink-0 overflow-hidden rounded-[2px] border border-black/15 shadow-sm",
        className,
      )}
    >
      <rect width="1" height="2" fill="#002395" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#CE1126" />
    </svg>
  );
}

/** Drapeau USA simplifié (lisible en petit). */
function FlagUs({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 19 10"
      aria-hidden
      className={cn(
        "h-[14px] w-[26.6px] shrink-0 overflow-hidden rounded-[2px] border border-black/15 shadow-sm",
        className,
      )}
    >
      <rect width="19" height="10" fill="#B22234" />
      {[1, 3, 5, 7, 9].map((y) => (
        <rect key={y} y={y} width="19" height="1" fill="#fff" />
      ))}
      <rect width="7.6" height="5.38" fill="#3C3B6E" />
      {[
        [1.9, 1.2],
        [3.8, 1.2],
        [5.7, 1.2],
        [2.85, 2.5],
        [4.75, 2.5],
        [1.9, 3.8],
        [3.8, 3.8],
        [5.7, 3.8],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="0.45" fill="#fff" />
      ))}
    </svg>
  );
}

function HeaderLanguageMenu({ language }: { language: AppLanguage }) {
  const { setLanguage } = useLanguage();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 w-[4.25rem] shrink-0 items-center justify-center gap-0.5 rounded-full border border-transparent px-1.5 text-foreground/90 transition-colors",
            "hover:border-border/50 hover:bg-background/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
          )}
          aria-label={i18n(language, {
            en: "Language",
            fr: "Langue",
          })}
        >
          <span className="flex h-[14px] w-7 shrink-0 items-center justify-center">
            {language === "fr" ? <FlagFr /> : <FlagUs />}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden strokeWidth={2.2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-0 p-1">
        <DropdownMenuItem
          onClick={() => setLanguage("fr")}
          className="cursor-pointer justify-center gap-0 px-3 py-2"
          aria-label={i18n(language, { en: "French", fr: "Français" })}
        >
          <FlagFr className="border-border/50" />
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage("en")}
          className="cursor-pointer justify-center gap-0 px-3 py-2"
          aria-label={i18n(language, { en: "English", fr: "Anglais" })}
        >
          <FlagUs className="border-border/50" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FloatingHeader() {
  const { user } = useAuth();
  const { language } = useLanguage();
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
    <div className="pointer-events-none fixed left-0 right-0 top-6 z-50 flex justify-center px-4">
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className={`pointer-events-auto flex w-full items-center justify-between rounded-full border px-6 py-3 transition-all duration-300 lg:max-w-[75%] ${
          hasScrolled
            ? "glass border-border/60"
            : "border-transparent bg-transparent shadow-none"
        }`}
      >
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="pointer-events-auto flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-80"
          >
            <div className="rounded-lg bg-primary/10 p-1.5">
              <img
                src="/favicon.png"
                alt="ScoreMax favicon"
                className="h-4 w-4 object-contain"
              />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">
              Score
              <span className="text-[#d6e4ff]">Max</span>
            </span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <HeaderLanguageMenu language={language} />
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
                <Button variant="ghost" size="sm" className="hidden rounded-full sm:flex">
                  {i18n(language, { en: "Login", fr: "Connexion" })}
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="rounded-sm px-6 shadow-lg shadow-primary/20">
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

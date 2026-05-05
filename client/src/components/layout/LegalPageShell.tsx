import type { ReactNode } from "react";
import { Link } from "wouter";
import { FloatingHeader } from "@/components/layout/FloatingHeader";
import { i18n, useAppLanguage } from "@/lib/i18n";

/** Même dégradé sombre que la section hero (sans grain animé landing ni vague). */
const legalPageBgClass =
  "min-h-screen bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)]";

export type LegalPageId = "legal-notice" | "terms" | "privacy";

const legalCrossLinks: {
  id: LegalPageId;
  href: string;
  label: { en: string; fr: string };
}[] = [
  {
    id: "legal-notice",
    href: "/legal-notice",
    label: { en: "Legal notice", fr: "Mentions légales" },
  },
  { id: "terms", href: "/terms", label: { en: "Terms", fr: "CGU" } },
  {
    id: "privacy",
    href: "/privacy",
    label: { en: "Privacy", fr: "Confidentialité" },
  },
];

export function LegalPageShell({
  title,
  current,
  children,
}: {
  title: string;
  current: LegalPageId;
  children: ReactNode;
}) {
  const language = useAppLanguage();
  const otherPages = legalCrossLinks.filter((item) => item.id !== current);

  return (
    <div className={legalPageBgClass}>
      <FloatingHeader language={language} />
      <main className="relative mx-auto w-full max-w-5xl px-4 pb-20 pt-[max(7.25rem,calc(env(safe-area-inset-top,0px)+5rem))] lg:max-w-[75%]">
        <div className="rounded-[2.2rem] border border-white/15 bg-black/30 p-6 shadow-[0_24px_90px_-58px_rgba(0,0,0,0.85)] backdrop-blur-sm md:p-10">
          <Link
            href="/"
            className="mb-8 inline-flex text-sm font-medium text-[#d6e4ff]/90 transition-colors hover:text-white"
          >
            {i18n(language, {
              en: "← Back to home",
              fr: "← Retour à l'accueil",
            })}
          </Link>
          <h1 className="font-hero mb-10 text-3xl font-semibold leading-tight tracking-[-0.015em] text-balance text-white md:text-4xl">
            {title}
          </h1>
          <div className="space-y-8 text-base font-medium leading-relaxed text-zinc-400">
            {children}
          </div>
        </div>

        <nav
          className="mt-10 px-1 sm:px-2"
          aria-label={i18n(language, {
            en: "Related legal documents",
            fr: "Documents juridiques associés",
          })}
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
            {i18n(language, {
              en: "Related legal documents",
              fr: "Documents juridiques associés",
            })}
          </p>
          <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-2">
            {otherPages.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="text-sm font-medium text-[#d6e4ff]/90 transition-colors hover:text-white"
                >
                  {i18n(language, item.label)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  );
}

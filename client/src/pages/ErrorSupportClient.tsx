import * as React from "react";
import { Link } from "wouter";
import { MessageCircle } from "lucide-react";
import { FloatingHeader } from "@/components/layout/FloatingHeader";
import { Button } from "@/components/ui/button";
import {
  consumeSupportErrorReport,
  type SupportErrorReportV1,
} from "@/lib/support-error-report-storage";
import { crispPush, initCrispWebsite } from "@/lib/crisp-client";
import { getPreferredLanguage, i18n, useAppLanguage, type AppLanguage } from "@/lib/i18n";

const legalPageBgClass =
  "min-h-screen bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)]";

function buildCrispPrefill(lang: AppLanguage, report: SupportErrorReportV1 | null): string {
  const tsIso = report ? new Date(report.ts).toISOString() : new Date().toISOString();
  const message = report?.message ?? "(no message)";
  const page = report?.href ?? (typeof window !== "undefined" ? window.location.href : "");
  const stack = report?.stack?.trim() || "—";
  const comp = report?.componentStack?.trim() || "—";
  const ua = report?.userAgent?.trim() || "—";

  if (lang === "fr") {
    return [
      "Bonjour,",
      "",
      "Une erreur s’est affichée dans ScoreMax. Voici les détails techniques :",
      "",
      `— Message —\n${message.slice(0, 4_000)}`,
      "",
      `— Page —\n${page}`,
      "",
      `— Horodatage (UTC) —\n${tsIso}`,
      "",
      `— Source —\n${report?.source ?? "unknown"}`,
      "",
      `— User-Agent —\n${ua.slice(0, 500)}`,
      "",
      `— Stack —\n${stack.slice(0, 6_000)}`,
      "",
      `— Arbre de composants —\n${comp.slice(0, 4_000)}`,
      "",
      "Merci pour votre aide.",
    ].join("\n");
  }

  return [
    "Hello,",
    "",
    "An error was shown in ScoreMax. Technical details:",
    "",
    `— Message —\n${message.slice(0, 4_000)}`,
    "",
    `— Page —\n${page}`,
    "",
    `— Timestamp (UTC) —\n${tsIso}`,
    "",
    `— Source —\n${report?.source ?? "unknown"}`,
    "",
    `— User-Agent —\n${ua.slice(0, 500)}`,
    "",
    `— Stack —\n${stack.slice(0, 6_000)}`,
    "",
    `— Component tree —\n${comp.slice(0, 4_000)}`,
    "",
    "Thank you.",
  ].join("\n");
}

/**
 * Page publique : chat Crisp avec message prérempli après une erreur (ErrorBoundary).
 * Aucun abonnement requis.
 */
export default function ErrorSupportClient() {
  const language = useAppLanguage();
  const [report] = React.useState(() => consumeSupportErrorReport());
  const [chatReady, setChatReady] = React.useState(false);

  React.useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    const previous = meta.getAttribute("content");
    meta.setAttribute("content", "noindex, follow");
    return () => {
      if (previous) meta.setAttribute("content", previous);
      else meta.setAttribute("content", "index, follow");
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const langForDraft = getPreferredLanguage();
    const prefill = buildCrispPrefill(langForDraft, report);

    void initCrispWebsite().then(() => {
      if (cancelled) return;
      crispPush(["set", "message:text", prefill]);
      crispPush(["do", "chat:show"]);
      crispPush(["do", "chat:open"]);
      setChatReady(true);
    });

    return () => {
      cancelled = true;
      crispPush(["do", "chat:hide"]);
    };
  }, [report]);

  React.useEffect(() => {
    if (!chatReady) return;
    crispPush(["set", "message:text", buildCrispPrefill(language, report)]);
  }, [language, report, chatReady]);

  function openChat() {
    crispPush(["do", "chat:show"]);
    crispPush(["do", "chat:open"]);
  }

  return (
    <div className={legalPageBgClass}>
      <FloatingHeader />
      <main className="relative mx-auto w-full max-w-2xl px-4 pb-20 pt-[max(7.25rem,calc(env(safe-area-inset-top,0px)+5rem))]">
        <div className="rounded-[2rem] border border-white/15 bg-black/35 p-6 text-center shadow-[0_24px_90px_-58px_rgba(0,0,0,0.85)] backdrop-blur-sm md:p-10">
          <Link
            href="/"
            className="mb-8 inline-flex text-sm font-medium text-[#d6e4ff]/90 transition-colors hover:text-white"
          >
            {i18n(language, {
              en: "← Back to home",
              fr: "← Retour à l'accueil",
            })}
          </Link>
          <h1 className="font-hero mb-4 text-2xl font-semibold leading-tight tracking-[-0.015em] text-white md:text-3xl">
            {i18n(language, {
              en: "Contact support",
              fr: "Contacter le support",
            })}
          </h1>
          <p className="mx-auto mb-8 max-w-lg text-pretty text-sm leading-relaxed text-zinc-400 md:text-base">
            {i18n(language, {
              en: "The chat should open automatically with a draft message that includes the error details. Send it as-is or add any context, then we can help you.",
              fr: "Le chat doit s’ouvrir automatiquement avec un brouillon contenant les détails de l’erreur. Envoie-le tel quel ou ajoute du contexte, et nous pourrons t’aider.",
            })}
          </p>
          <Button
            type="button"
            onClick={openChat}
            disabled={!chatReady}
            className="h-12 rounded-full border border-white/20 bg-white/10 px-6 font-semibold text-white shadow-[0_18px_55px_-28px_rgba(255,255,255,0.35)] transition hover:bg-white/15"
          >
            <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
            {i18n(language, {
              en: "Open support chat",
              fr: "Ouvrir le chat support",
            })}
          </Button>
          {!report ? (
            <p className="mt-6 text-xs text-zinc-500">
              {i18n(language, {
                en: "No error report was found for this tab. You can still describe what happened in the chat.",
                fr: "Aucun rapport d’erreur n’a été trouvé pour cet onglet. Tu peux tout de même décrire ce qui s’est passé dans le chat.",
              })}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}

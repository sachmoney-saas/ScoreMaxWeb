import { cn } from "@/lib/utils";

/** Texte affiché sous les recommandations / protocole (FR + EN). */
export const educationalDisclaimerI18n = {
  en: "Educational content only — not medical advice. Before changing your routine, please consult a qualified professional.",
  fr: "Contenu éducatif uniquement — ne constitue pas un avis médical. Avant tout changement de routine, veuillez consulter un professionnel qualifié.",
} as const;

export const educationalDisclaimerWrapperClassName =
  "flex justify-center border-t border-white/10 pt-4";

/** Bloc lisible sur fond Glass / Wave : fond sombre léger + bordure noire + texte blanc contrasté. */
export const educationalDisclaimerNoticeClassName = cn(
  "max-w-xl rounded-xl border border-black px-4 py-3",
  "text-center text-[11px] font-medium leading-snug text-white antialiased sm:px-5 sm:text-xs sm:leading-relaxed",
  "bg-black/70 backdrop-blur-sm",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_24px_-6px_rgba(0,0,0,0.75)]",
  "[text-shadow:0_1px_2px_rgb(0_0_0_/_0.85)]",
);

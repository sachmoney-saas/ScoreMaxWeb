/**

 * Coque visuelle partagée (auth, onboarding) — fond + panneaux glass SaaS.

 */



/** Voile au-dessus du WaveBackground — léger pour laisser voir l’animation. */

export const authPageOverlayClassName =

  "pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(ellipse_115%_75%_at_50%_-15%,rgba(255,255,255,0.1),transparent_58%),linear-gradient(180deg,rgba(6,10,16,0.28)_0%,rgba(10,16,22,0.38)_48%,rgba(6,10,16,0.44)_100%)]";



/** Panneau glass principal (carte étape, formulaire auth). */

export const saasGlassPanelClassName =

  "rounded-[2.25rem] border border-white/18 bg-[linear-gradient(165deg,rgba(22,30,42,0.28)_0%,rgba(14,20,28,0.34)_42%,rgba(10,14,20,0.4)_100%)] shadow-[0_32px_90px_-48px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.06)_inset] backdrop-blur-xl sm:rounded-[2.5rem]";



/** Encart interne (preuves, graphique, messages). */

export const saasGlassInsetClassName =

  "rounded-2xl border border-white/12 bg-white/[0.06]";



/** Contenu Radix dropdown — même glass / bordure que les panneaux (rayon menu). */

export const saasGlassDropdownMenuContentClassName =

  "rounded-xl border border-white/18 bg-[linear-gradient(165deg,rgba(22,30,42,0.28)_0%,rgba(14,20,28,0.34)_42%,rgba(10,14,20,0.4)_100%)] p-1.5 text-zinc-100 shadow-[0_32px_90px_-48px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.06)_inset] backdrop-blur-xl";



/** Carte formulaire auth — panneau + padding. */

export const authPageCardClassName = `${saasGlassPanelClassName} p-5 sm:p-6`;



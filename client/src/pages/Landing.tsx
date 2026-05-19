import * as React from "react";
import { Link } from "wouter";
import { WaveBackground } from "@/components/background/WaveBackground";
import { LandingCompleteAnalysisOrbit } from "@/components/landing/LandingCompleteAnalysisOrbit";
import { FloatingHeader } from "@/components/layout/FloatingHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PictureAvif } from "@/components/ui/picture-avif";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { primaryCtaSurfaceClassName } from "@/lib/cta-button-styles";
import { i18n, useAppLanguage, type AppLanguage } from "@/lib/i18n";
import { onboardingPortraitFrameCompactClassName } from "@/lib/onboarding-portrait-media";
import { cn } from "@/lib/utils";

type AppearanceImpactItem = {
  title: string;
  description: string;
  source: string;
};

type AppearanceImpactCategory = {
  key:
    | "finances"
    | "dating"
    | "socializing"
    | "health"
    | "education"
    | "law"
    | "influence"
    | "happiness";
  label: string;
  items: AppearanceImpactItem[];
};

const visibleAppearanceImpactCategoryKeys = new Set<AppearanceImpactCategory["key"]>([
  "finances",
  "dating",
  "health",
  "law",
]);

function splitImpactTitle(title: string) {
  const [firstWord, ...rest] = title.split(" ");

  return {
    firstWord,
    rest: rest.join(" "),
  };
}

const appearanceImpactCategories: AppearanceImpactCategory[] = [
  {
    key: "finances",
    label: "Finance",
    items: [
      {
        title: "Salaire plus élevé",
        description: "Les personnes attirantes gagnent 10-15% de plus.",
        source:
          "Hamermesh, D. S., and J. E. Biddle. (1994). The American Economic Review.",
      },
      {
        title: "Entretiens d'embauche facilités",
        description:
          "Les candidats attirants sont perçus comme plus qualifiés.",
        source:
          "Puleo, R. (2006). Journal of Undergraduate Psychological Research.",
      },
      {
        title: "Pourboires plus élevés",
        description:
          "Les serveurs attirants reçoivent $1261 de pourboires en plus par an.",
        source: "Parrett, M. (2015). Journal of Economic Psychology.",
      },
      {
        title: "Plus de ventes",
        description:
          "Les clients ont 55% plus de chances d'acheter à des vendeurs attirants.",
        source:
          "Reingen, P. H., and Kernan, J. B. (1993). Journal of Consumer Psychology.",
      },
    ],
  },
  {
    key: "dating",
    label: "Rencontre",
    items: [
      {
        title: "Plus de matchs",
        description:
          "Sur les apps de rencontre, l'apparence compte environ 9 fois plus que la bio.",
        source:
          "Witmer, J., Rosenbusch, H., and Meral, E. O. (2025). Computers in Human Behavior Reports.",
      },
      {
        title: "Plus de deuxièmes rendez-vous",
        description:
          "Dans les études de speed-dating, l'apparence prédit régulièrement le succès.",
        source:
          "Eastwick, P. W., and Finkel, E. J. (2008). Journal of Personality and Social Psychology; Luo, S., and Zhang, G. (2009).",
      },
      {
        title: "Partenaires plus désirables",
        description:
          "Les gens finissent généralement avec quelqu'un de leur ligue, côté apparence.",
        source: "Luo, S. Social and Personality Psychology. 2017.",
      },
      {
        title: "Plus important qu'on ne le pense",
        description:
          "Les gens sous-estiment a quel point l'apparence influence leurs choix romantiques.",
        source:
          "Eastwick et al. (2024). Journal of Personality and Social Psychology.",
      },
    ],
  },
  {
    key: "socializing",
    label: "Vie sociale",
    items: [
      {
        title: "Plus drole",
        description:
          "Les personnes attirantes sont jugees plus droles en video qu'en audio.",
        source:
          "Cowan, M. L., and Little, A. C. (2013). Personality and Individual Differences.",
      },
      {
        title: "Plus sain",
        description:
          "Les personnes attirantes sont percues comme plus en bonne sante.",
        source:
          "Zebrowitz, L. A., and Franklin Jr, R. G. (2014). Experimental Aging Research.",
      },
      {
        title: "Plus intelligent",
        description: "Les personnes attirantes sont jugees plus intelligentes.",
        source:
          "Moore, F. R., Filippou, D., and Perrett, D. I. (2011). Journal of Evolutionary Psychology.",
      },
      {
        title: "Mieux percu",
        description:
          "Les personnes attirantes sont percues comme plus morales et plus dignes de confiance.",
        source:
          "Shinners, E. (2009). UW-L Journal of Undergraduate Research; Klebl et al. (2022). Journal of Nonverbal Behavior.",
      },
    ],
  },
  {
    key: "health",
    label: "Santé",
    items: [
      {
        title: "Meilleure prise en charge",
        description:
          "Les médecins manquent 3.67 fois plus de diagnostics pour les patients jugés peu attirants.",
        source:
          "Tsiga, E., Panagopoulou, E., and Benos, A. (2016). European Journal for Person Centered Healthcare.",
      },
      {
        title: "Mode de vie plus sain",
        description:
          "Les activités qui te rendent plus attirant sont souvent bonnes pour toi.",
        source:
          "Arnocky, S., and Davis, A. C. (2024). Frontiers in Psychology.",
      },
      {
        title: "Vies plus longues",
        description:
          "Les personnes attirantes vivent plus longtemps (peut-être en partie grâce aux raisons ci-dessus).",
        source:
          "Henderson, J.J.A., and Anglin, J.M. (2003). Evolution and Human Behavior.",
      },
    ],
  },
  {
    key: "education",
    label: "Education",
    items: [
      {
        title: "Attentes des enseignants plus elevees",
        description:
          "Les enseignants attribuent aux eleves juges plus attirants des attentes de reussite, d'intelligence et d'integration sociale nettement plus elevees qu'aux autres.",
        source:
          "Clifford, M. M., and Walster, E. (1973). Sociology of Education.",
      },
      {
        title: "Illusion de meilleure scolarite",
        description:
          "Les eleves physiquement attirants sont souvent juges plus doues ou plus travailleurs, independamment de leurs resultats reels et avant meme un contact pedagogique approfondi.",
        source:
          "Ritts, V., Patterson, M. L., and Tubbs, M. E. (1992). Review of Educational Research.",
      },
      {
        title: "Notes sensibles a l'apparence",
        description:
          "En enseignement presentiel, la beaute percue est associee a de meilleures notes surtout quand l'interaction avec l'enseignant est frequente, ce qui evoque un biais d'evaluation plutot qu'un simple hasard.",
        source: "Mehic, A. (2022). Economics Letters.",
      },
    ],
  },
  {
    key: "law",
    label: "Justice",
    items: [
      {
        title: "Moins d'arrestations",
        description:
          "Les personnes attirantes sont moins susceptibles d'être arrêtées.",
        source:
          "Beaver, K. M., Boccio, C., Smith, S., and Ferguson, C. J. (2019). Psychiatry, Psychology and Law.",
      },
      {
        title: "Moins de condamnations",
        description:
          "Les personnes attirantes sont moins susceptibles d'être condamnées.",
        source:
          "Beaver, K. M., Boccio, C., Smith, S., and Ferguson, C. J. (2019). Psychiatry, Psychology and Law.",
      },
      {
        title: "Peines plus légères",
        description:
          "En cas de condamnation, les personnes attirantes reçoivent des peines plus légères.",
        source:
          "Mazzella, R., and Feingold, A. (1994). Journal of Applied Social Psychology.",
      },
    ],
  },
  {
    key: "influence",
    label: "Influence",
    items: [
      {
        title: "Meilleur reseautage",
        description:
          "Les personnes attirantes construisent des reseaux sociaux plus denses.",
        source: "O'Connor, K. M., and Gladstone, E. (2018). Social Networks.",
      },
      {
        title: "Plus de leadership",
        description: "Les politiciens attirants obtiennent plus de votes.",
        source: "Jaeger et al. (2021). Social Psychology.",
      },
      {
        title: "Plus de promotions",
        description:
          "Les personnes attirantes ont plus de chances d'etre promues.",
        source:
          "Morrow, P. C., McElroy, J. C., Stamper, B. G., and Wilson, M. A. (1990). Journal of Management.",
      },
      {
        title: "Plus de followers",
        description:
          "Les personnes attirantes obtiennent un engagement plus favorable sur les reseaux sociaux.",
        source:
          "Gladstone, E. C., and O'Connor, K. (2013). Academy of Management Proceedings; Strey, S. (2019). MSc dissertation; Lund University.",
      },
    ],
  },
  {
    key: "happiness",
    label: "Bonheur",
    items: [
      {
        title: "Bien-etre plus eleve",
        description:
          "Les personnes attirantes declarent un niveau de bien-etre plus eleve.",
        source:
          "Datta Gupta, N., Etcoff, N. L., and Jaeger, M. M. (2016). Journal of Happiness Studies.",
      },
      {
        title: "Moins de troubles mentaux",
        description:
          "Les personnes en meilleure sante mentale sont, en moyenne, plus attirantes.",
        source:
          "Farina et al. (1977). Journal of Abnormal Psychology; Borraz-Leon et al. (2021). Adaptive Human Behavior and Physiology.",
      },
    ],
  },
];

const appearanceImpactEnglishContent: Record<
  AppearanceImpactCategory["key"],
  {
    label: string;
    items: Record<string, { title: string; description: string }>;
  }
> = {
  finances: {
    label: "Finances",
    items: {
      "Salaire plus élevé": {
        title: "Higher income",
        description: "Attractive people earn 10-15% more.",
      },
      "Entretiens d'embauche facilités": {
        title: "Easier hiring outcomes",
        description: "Attractive candidates are perceived as more qualified.",
      },
      "Pourboires plus élevés": {
        title: "Higher tips",
        description: "Attractive waiters receive $1,261 more in yearly tips.",
      },
      "Plus de ventes": {
        title: "More sales",
        description:
          "Customers are 55% more likely to buy from attractive salespeople.",
      },
    },
  },
  dating: {
    label: "Dating",
    items: {
      "Plus de matchs": {
        title: "More matches",
        description:
          "On dating apps, appearance matters about 9 times more than your bio.",
      },
      "Plus de deuxièmes rendez-vous": {
        title: "More second dates",
        description:
          "In speed-dating studies, appearance consistently predicts success.",
      },
      "Partenaires plus désirables": {
        title: "More desirable partners",
        description:
          "People usually end up with someone in their own appearance league.",
      },
      "Plus important qu'on ne le pense": {
        title: "More important than people think",
        description:
          "People underestimate how much appearance influences romantic choices.",
      },
    },
  },
  socializing: {
    label: "Social life",
    items: {
      "Plus drole": {
        title: "Seen as funnier",
        description:
          "Attractive people are judged funnier in video than in audio-only.",
      },
      "Plus sain": {
        title: "Seen as healthier",
        description:
          "Attractive people are perceived as being in better health.",
      },
      "Plus intelligent": {
        title: "Seen as smarter",
        description: "Attractive people are judged as more intelligent.",
      },
      "Mieux percu": {
        title: "Better perceived overall",
        description:
          "Attractive people are perceived as more moral and trustworthy.",
      },
    },
  },
  health: {
    label: "Health",
    items: {
      "Meilleure prise en charge": {
        title: "Better care quality",
        description:
          "Doctors miss 3.67x more diagnoses for patients judged less attractive.",
      },
      "Mode de vie plus sain": {
        title: "Healthier lifestyle",
        description:
          "Activities that make you more attractive are often good for your health.",
      },
      "Vies plus longues": {
        title: "Longer lives",
        description:
          "Attractive people tend to live longer (possibly partly due to factors above).",
      },
    },
  },
  education: {
    label: "Education",
    items: {
      "Attentes des enseignants plus elevees": {
        title: "Higher teacher expectations",
        description:
          "Teachers attribute higher expected achievement, intelligence, and social integration to more attractive students.",
      },
      "Illusion de meilleure scolarite": {
        title: "Illusion of better school performance",
        description:
          "Attractive students are often judged as more capable or diligent, independently of real outcomes.",
      },
      "Notes sensibles a l'apparence": {
        title: "Grades sensitive to appearance",
        description:
          "In in-person teaching, perceived beauty is associated with better grades, especially when teacher interaction is frequent.",
      },
    },
  },
  law: {
    label: "Justice",
    items: {
      "Moins d'arrestations": {
        title: "Fewer arrests",
        description: "Attractive people are less likely to be arrested.",
      },
      "Moins de condamnations": {
        title: "Fewer convictions",
        description: "Attractive people are less likely to be convicted.",
      },
      "Peines plus légères": {
        title: "Lighter sentences",
        description:
          "When convicted, attractive people tend to receive lighter sentences.",
      },
    },
  },
  influence: {
    label: "Influence",
    items: {
      "Meilleur reseautage": {
        title: "Better networking",
        description:
          "Attractive people build denser and more effective social networks.",
      },
      "Plus de leadership": {
        title: "More leadership",
        description: "Attractive politicians receive more votes.",
      },
      "Plus de promotions": {
        title: "More promotions",
        description: "Attractive people are more likely to get promoted.",
      },
      "Plus de followers": {
        title: "More followers",
        description:
          "Attractive people get more favorable engagement on social media.",
      },
    },
  },
  happiness: {
    label: "Happiness",
    items: {
      "Bien-etre plus eleve": {
        title: "Higher well-being",
        description:
          "Attractive people report higher levels of subjective well-being.",
      },
      "Moins de troubles mentaux": {
        title: "Fewer mental health disorders",
        description:
          "People with better mental health are, on average, perceived as more attractive.",
      },
    },
  },
};

export default function Landing() {
  const language = useAppLanguage();
  const { user } = useAuth();
  const heroCtaHref = user ? "/app/new-analysis" : "/register";
  const [activeAppearanceCategoryKey, setActiveAppearanceCategoryKey] =
    React.useState<AppearanceImpactCategory["key"]>("finances");
  const localizedAppearanceImpactCategories = React.useMemo(
    () =>
      appearanceImpactCategories
        .filter((category) => visibleAppearanceImpactCategoryKeys.has(category.key))
        .map((category) => ({
          ...category,
          label:
            language === "en"
              ? appearanceImpactEnglishContent[category.key].label
              : category.label,
          items:
            language === "en"
              ? category.items.map((item) => {
                  const translated =
                    appearanceImpactEnglishContent[category.key].items[item.title];
                  return translated
                    ? {
                        ...item,
                        title: translated.title,
                        description: translated.description,
                      }
                    : item;
                })
              : category.items,
        })),
    [language],
  );
  const activeAppearanceCategory =
    localizedAppearanceImpactCategories.find(
      (category) => category.key === activeAppearanceCategoryKey,
    ) ?? localizedAppearanceImpactCategories[0];
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  const handleCompleteAnalysisClick = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();

      const target = document.getElementById("complete-analysis");
      if (!target) {
        return;
      }

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const fixedHeader = document.querySelector("header");
      const headerBottom =
        fixedHeader instanceof HTMLElement
          ? fixedHeader.getBoundingClientRect().bottom
          : 0;
      const scrollOffset = Math.ceil(headerBottom + 24);
      const targetTop =
        target.getBoundingClientRect().top + window.scrollY - scrollOffset;

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
      window.history.pushState(null, "", "#complete-analysis");
    },
    [],
  );

  return (
    <div className="landing-grain min-h-screen bg-background relative">
      <FloatingHeader />

      {/* Hero — everything is height-aware so the preview stays inside one viewport. */}
      <section className="relative isolate flex h-[100svh] max-h-[100svh] min-h-[100svh] flex-col overflow-hidden bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] px-4 pb-2 pt-[max(5.75rem,calc(env(safe-area-inset-top,0px)+1.25rem))] sm:pb-3 sm:pt-[max(5rem,calc(env(safe-area-inset-top,0px)+1.25rem))] lg:pb-4 lg:pt-[max(5rem,calc(env(safe-area-inset-top,0px)+1.25rem))]">
        <div className="relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col lg:max-w-[75%]">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10 flex min-h-0 flex-1 flex-col justify-start px-1 py-2 pt-[clamp(1rem,4.2svh,2.35rem)] sm:px-2 sm:py-3 sm:pt-[clamp(0.5rem,3svh,1.75rem)] md:py-4 lg:pt-[clamp(1rem,5svh,3.25rem)] xl:pt-[clamp(1.25rem,5.5svh,3.75rem)]"
          >
            <div className="mx-auto w-full max-w-[36rem] space-y-[clamp(0.75rem,2.1svh,1.5rem)] text-center sm:max-w-2xl lg:max-w-3xl">
              <motion.h1
                variants={itemVariants}
                className="mx-auto max-w-[min(100%,24rem)] font-hero text-[clamp(2.15rem,min(6.5vw+0.75rem,10.75svh),4.5rem)] font-semibold leading-[1.04] tracking-[-0.015em] text-balance text-white sm:max-w-2xl sm:leading-[1.06] md:max-w-3xl lg:max-w-4xl xl:text-[clamp(2.5rem,min(5vw+1rem,10.75svh),4.75rem)]"
              >
                {language === "fr" ? (
                  <>
                    Deviens un <span className="text-[#d6e4ff]">10/10</span> grâce à la{" "}
                    <span className="text-[#d6e4ff]">Science</span>
                  </>
                ) : (
                  <>
                    Become a <span className="text-[#d6e4ff]">10/10</span> with{" "}
                    <span className="text-[#d6e4ff]">Science</span>
                  </>
                )}
              </motion.h1>
              <motion.h2
                variants={itemVariants}
                className="mx-auto max-w-[min(100%,36rem)] text-balance font-sans text-[clamp(0.95rem,min(2.3svh,1.125rem),1.125rem)] font-medium leading-[1.45] tracking-tight text-foreground/72 md:max-w-xl lg:max-w-2xl"
              >
                {i18n(language, {
                  en: "AI scans your face, scores you out of 100, and delivers the exact plan to transform in 90 days.",
                  fr: "L'IA scanne ton visage, te note sur 100 et te livre le plan exact pour te transformer en 90 jours.",
                })}
              </motion.h2>
              <motion.div
                variants={itemVariants}
                className="flex flex-col items-center gap-0 pt-0.5"
              >
                <Link
                  href={heroCtaHref}
                  className="pointer-events-auto inline-flex min-h-[clamp(2.75rem,6svh,3.5rem)] items-center justify-center rounded-sm border border-primary-border bg-primary px-7 text-base font-semibold text-primary-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_12px_40px_-8px_rgba(0,0,0,0.45)] hover-elevate active-elevate-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:px-10 sm:text-lg md:px-11 md:text-[1.0625rem]"
                >
                  {i18n(language, {
                    en: "Discover my score",
                    fr: "Découvrir mon score",
                  })}
                </Link>
                <div
                  role="img"
                  aria-label={i18n(language, {
                    en: "Before and after",
                    fr: "Avant et après",
                  })}
                  className="relative mt-[clamp(3.25rem,7svh,5.5rem)] w-fit max-w-full"
                >
                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    <div
                      className={cn(
                        onboardingPortraitFrameCompactClassName,
                        "w-[clamp(6.75rem,min(23svh,42vw),13.75rem)]",
                      )}
                    >
                      <PictureAvif
                        avifSrc="/modelav1.avif"
                        fallbackSrc="/modelav1.jpeg"
                        alt=""
                        className="block h-full w-full"
                        imgClassName="h-full w-full object-cover object-center"
                      />
                    </div>
                    <ArrowRight
                      className="h-6 w-6 shrink-0 text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] sm:h-7 sm:w-7"
                      strokeWidth={2.2}
                      aria-hidden
                    />
                    <div
                      className={cn(
                        onboardingPortraitFrameCompactClassName,
                        "w-[clamp(6.75rem,min(23svh,42vw),13.75rem)]",
                      )}
                    >
                      <PictureAvif
                        avifSrc="/modelap1.avif"
                        fallbackSrc="/modelap1.jpeg"
                        alt=""
                        className="block h-full w-full"
                        imgClassName="h-full w-full object-cover object-center"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          <motion.a
            href="#complete-analysis"
            onClick={handleCompleteAnalysisClick}
            aria-label={i18n(language, {
              en: "Scroll to next section",
              fr: "Descendre vers la section suivante",
            })}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: [0, 5, 0] }}
            transition={{
              opacity: { duration: 0.35, delay: 0.25 },
              y: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
            }}
            className="mt-auto hidden shrink-0 justify-center pb-1 pt-2 text-foreground/55 transition-colors hover:text-foreground/90 sm:pb-2 sm:pt-3 [@media(min-height:720px)]:flex"
          >
            <ChevronDown className="h-8 w-8 sm:h-9 sm:w-9" strokeWidth={1.8} />
          </motion.a>
        </div>
      </section>

      <div className="relative z-0 isolate overflow-x-clip bg-[#15242b]">
        <WaveBackground
          position="absolute"
          className="pointer-events-none z-0 !h-full !min-h-full !w-full"
        />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_34%_18%,rgba(255,255,255,0.08),transparent_36%),linear-gradient(180deg,rgba(6,13,16,0.08)_0%,rgba(6,13,16,0.3)_100%)]" />

        {/* Complete Analysis — mobile: hauteur au contenu (< 100vh OK) ; md+: 1 viewport, image calée en bas */}
        <section
          id="complete-analysis"
          className="relative z-10 isolate flex scroll-mt-32 flex-col overflow-x-clip overflow-y-visible bg-transparent px-4 pb-0 pt-8 md:h-[100svh] md:max-h-[100svh] md:scroll-mt-36 md:pt-10"
        >
          <div className="relative z-10 mx-auto flex w-full max-w-[min(100%,112rem)] flex-col px-3 sm:px-4 md:min-h-0 md:flex-1 lg:px-6">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              className="relative z-30 flex flex-col items-center gap-4 text-center md:min-h-0 md:flex-1 md:gap-6"
            >
              <motion.h2
                variants={itemVariants}
                className="relative z-30 shrink-0 font-hero text-3xl font-bold leading-[1.1] tracking-tight text-balance text-white [text-shadow:0_0_1px_rgba(0,0,0,0.75),0_2px_10px_rgba(0,0,0,0.45),0_6px_32px_rgba(15,23,42,0.35)] md:text-5xl"
              >
                {i18n(language, {
                  en: "Your Complete Facial Analysis",
                  fr: "Ton analyse faciale complète",
                })}
              </motion.h2>
              <motion.p
                variants={itemVariants}
                className="relative z-30 mx-auto max-w-[min(100%,48rem)] -mt-1 shrink-0 text-balance text-sm font-medium leading-[1.5] text-white/78 [text-shadow:0_1px_10px_rgba(0,0,0,0.45)] sm:text-base md:-mt-2 md:text-lg"
              >
                {i18n(language, {
                  en: "Every face is unique. We analyse dozens of aspects of your face to understand your personal facial aesthetics.",
                  fr: "Chaque visage est unique. Nous analysons des dizaines d’aspects de votre visage afin de comprendre votre esthétique faciale personnelle.",
                })}
              </motion.p>

              <motion.div
                variants={itemVariants}
                className="relative z-0 flex w-full max-w-[min(100%,96rem)] flex-col leading-none md:min-h-0 md:flex-1 md:justify-end"
              >
                <LandingCompleteAnalysisOrbit language={language}>
                  <img
                    src="/model1.png"
                    alt={i18n(language, {
                      en: "Your complete facial analysis model",
                      fr: "Modèle d'analyse complète du visage",
                    })}
                    loading="lazy"
                    className="mx-auto block h-auto w-full max-w-full object-contain object-bottom select-none max-h-[min(93vh,1080px)]"
                  />
                </LandingCompleteAnalysisOrbit>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </div>

      {/* Appearance Impact Section */}
      <section
        id="appearance-impact"
        className="bg-[radial-gradient(circle_at_72%_24%,rgba(255,255,255,0.14),transparent_34%),radial-gradient(circle_at_24%_82%,rgba(185,204,209,0.13),transparent_40%),linear-gradient(145deg,rgba(10,16,22,0.93)_0%,rgba(20,31,39,0.89)_48%,rgba(185,204,209,0.29)_100%)] px-4 py-20 md:py-28"
      >
        <div className="mx-auto w-full max-w-[52rem]">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            className="space-y-8"
          >
            <motion.h2
              variants={itemVariants}
              className="mx-auto max-w-[52rem] text-center font-hero text-3xl font-semibold leading-[1.06] tracking-[-0.015em] text-balance md:text-5xl"
            >
              {i18n(language, {
                en: "Beauty can be",
                fr: "La beauté peut être",
              })}
              {" "}
              <span className="block">
                {language === "fr" ? (
                  <>
                    <span className="text-[#d6e4ff]">mesurée</span> et{" "}
                    <span className="text-[#d6e4ff]">améliorée</span>
                  </>
                ) : (
                  <>
                    <span className="text-[#d6e4ff]">measured</span> and{" "}
                    <span className="text-[#d6e4ff]">improved</span>
                  </>
                )}
              </span>
            </motion.h2>

            <motion.div variants={itemVariants} className="w-full">
              <Tabs
                value={activeAppearanceCategoryKey}
                onValueChange={(value) =>
                  setActiveAppearanceCategoryKey(
                    value as AppearanceImpactCategory["key"],
                  )
                }
                className="w-full"
              >
                <div className="overflow-x-auto pb-5 md:flex md:justify-center">
                  <TabsList className="mx-auto flex h-auto w-max min-w-max gap-2 rounded-none bg-transparent p-0 sm:gap-3">
                    {localizedAppearanceImpactCategories.map((category) => (
                      <TabsTrigger
                        key={category.key}
                        value={category.key}
                        className="box-border h-11 min-w-[7rem] flex-none rounded-[0.65rem] border border-transparent bg-transparent px-4 text-sm leading-none text-zinc-400 shadow-none transition-colors hover:bg-white/[0.05] hover:text-zinc-100 data-[state=active]:border-white/10 data-[state=active]:bg-[#9fb2bb]/25 data-[state=active]:text-white data-[state=active]:shadow-none sm:min-w-[7.75rem]"
                      >
                        {category.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {activeAppearanceCategory ? (
                    <motion.div
                      key={activeAppearanceCategory.key}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                    >
                      <TabsContent
                        value={activeAppearanceCategory.key}
                        className="mt-0"
                        forceMount
                      >
                        <div className="overflow-hidden rounded-2xl border border-white/[0.28] bg-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                          {activeAppearanceCategory.items.map((item, index) => {
                            const { firstWord, rest } = splitImpactTitle(item.title);

                            return (
                              <article
                                key={`${activeAppearanceCategory.key}-${item.title}`}
                                className={cn(
                                  "grid gap-3 overflow-hidden px-5 py-5 text-left sm:px-6 md:h-[7.25rem] md:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.35fr)] md:gap-8 md:px-7 lg:px-8",
                                  index > 0 && "border-t border-white/[0.14]",
                                )}
                              >
                                <h3 className="font-display text-lg font-semibold leading-tight tracking-tight text-white md:text-xl">
                                  {firstWord}
                                  {rest ? (
                                    <span className="text-[#9fb2bb]"> {rest}</span>
                                  ) : null}
                                </h3>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold leading-relaxed text-zinc-100 md:text-base">
                                    {item.description}
                                  </p>
                                  <p className="mt-2 flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[0.625rem] leading-none text-zinc-500 md:text-[0.6875rem]">
                                    <span className="h-1 w-1 shrink-0 rounded-full border border-[#9fb2bb]/55" />
                                    <span className="min-w-0 truncate">
                                      {item.source}
                                    </span>
                                  </p>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </TabsContent>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </Tabs>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative isolate flex min-h-[28rem] overflow-hidden px-4 py-24 md:min-h-[34rem] md:py-32">
        <WaveBackground
          position="absolute"
          className="pointer-events-none z-0 !h-full !min-h-full !w-full"
        />
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_48%_44%,rgba(255,255,255,0.18),transparent_32%),linear-gradient(180deg,rgba(9,21,25,0.08)_0%,rgba(6,13,16,0.22)_100%)]" />
        <div className="relative z-10 mx-auto flex w-full max-w-4xl items-center justify-center text-center">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            className="flex flex-col items-center gap-10"
          >
            <motion.h2
              variants={itemVariants}
              className="max-w-3xl text-balance font-hero text-4xl font-semibold leading-[1.08] tracking-[-0.015em] text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.25)] md:text-5xl"
            >
              {i18n(language, {
                en: "Join thousands already transforming their looks.",
                fr: "Rejoins ceux qui transforment déjà leur apparence.",
              })}
            </motion.h2>

            <motion.div variants={itemVariants}>
              <Link
                href={heroCtaHref}
                className="group inline-flex min-h-14 overflow-hidden rounded-[0.35rem] border border-white/70 bg-white text-sm font-semibold text-[#071319] shadow-[0_18px_50px_-24px_rgba(0,0,0,0.7)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:text-base"
              >
                <span className="flex items-center px-5 md:px-6">
                  {i18n(language, {
                    en: "Start your glow-up",
                    fr: "Démarrer ma transformation",
                  })}
                </span>
                <span className="flex w-12 items-center justify-center border-l border-zinc-200 text-[#071319]">
                  <ArrowRight
                    className="h-4 w-4 motion-safe:group-hover:animate-[cta-arrow-nudge_0.75s_ease-in-out_infinite]"
                    strokeWidth={2.2}
                    aria-hidden
                  />
                </span>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.12),transparent_36%),radial-gradient(circle_at_18%_78%,rgba(185,204,209,0.11),transparent_42%),linear-gradient(145deg,rgba(10,16,22,0.94)_0%,rgba(20,31,39,0.9)_48%,rgba(185,204,209,0.26)_100%)] py-12">
        <div className="mx-auto w-full max-w-5xl px-4 lg:max-w-[75%]">
          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-1.5 rounded-lg">
                <img
                  src="/favicon.png"
                  alt="ScoreMax favicon"
                  className="h-3 w-3 object-contain"
                />
              </div>
              <span className="font-display font-bold text-lg tracking-tight">
                Score
                <span className="text-[#d6e4ff]">Max</span>
              </span>
            </div>

            <nav className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <Link
                href="/legal-notice"
                className="hover:text-primary transition-colors"
              >
                {i18n(language, {
                  en: "Legal Notice",
                  fr: "Mentions Légales",
                })}
              </Link>
              <Link
                href="/terms"
                className="hover:text-primary transition-colors"
              >
                {i18n(language, {
                  en: "Terms",
                  fr: "CGU",
                })}
              </Link>
              <Link
                href="/privacy"
                className="hover:text-primary transition-colors"
              >
                {i18n(language, {
                  en: "Privacy",
                  fr: "Confidentialité",
                })}
              </Link>
            </nav>

            <div className="text-center text-muted-foreground md:text-right">
              <p className="text-sm">
                {i18n(language, {
                  en: "© 2026 ScoreMax. All rights reserved.",
                  fr: "© 2026 ScoreMax. Tous droits réservés.",
                })}
              </p>
              <p className="mt-1 text-xs">V1.05</p>
            </div>
          </div>

          <p
            role="note"
            className="mx-auto mt-8 max-w-3xl text-center text-[0.6875rem] leading-relaxed text-zinc-500 sm:text-xs"
          >
            {i18n(language, {
              en:
                "Medical disclaimer: ScoreMax may display automated suggestions described as recommendations. These are educational and general-wellness information only, based on algorithmic outputs; they do not constitute personalised medical, surgical, orthodontic, dermatological, or psychological advice, diagnosis, or treatment, and cannot replace consultation with a qualified licensed healthcare professional.",
              fr:
                "Avertissement : ScoreMax peut afficher des suggestions présentées comme des recommandations. Celles-ci relèvent d’une information générale et d’un contenu éducatif fondé sur des résultats produits automatiquement par le Service ; elles ne constituent pas un conseil médical, chirurgical, orthodontique, dermatologique ou psychologique personnalisé, ni un diagnostic ni un traitement, et ne se substituent en aucun cas à une consultation auprès d’un professionnel de santé dûment habilité.",
            })}
          </p>
        </div>
      </footer>
    </div>
  );
}

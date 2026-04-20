import * as React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

function FloatingHeader() {
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
              <Button size="sm" className="rounded-full px-6">
                App
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
                  Connexion
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="sm"
                  className="rounded-full px-6 shadow-lg shadow-primary/20"
                >
                  Démarrer
                </Button>
              </Link>
            </>
          )}
        </div>
      </motion.header>
    </div>
  );
}

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

const appearanceImpactCategories: AppearanceImpactCategory[] = [
  {
    key: "finances",
    label: "Finances",
    items: [
      {
        title: "Salaire plus eleve",
        description: "Les personnes attirantes gagnent 10-15% de plus.",
        source:
          "Hamermesh, D. S., and J. E. Biddle. (1994). The American Economic Review.",
      },
      {
        title: "Entretiens d'embauche facilites",
        description:
          "Les candidats attirants sont percus comme plus qualifies.",
        source:
          "Puleo, R. (2006). Journal of Undergraduate Psychological Research.",
      },
      {
        title: "Pourboires plus eleves",
        description:
          "Les serveurs attirants recoivent $1261 de pourboires en plus par an.",
        source: "Parrett, M. (2015). Journal of Economic Psychology.",
      },
      {
        title: "Plus de ventes",
        description:
          "Les clients ont 55% plus de chances d'acheter a des vendeurs attirants.",
        source:
          "Reingen, P. H., and Kernan, J. B. (1993). Journal of Consumer Psychology.",
      },
    ],
  },
  {
    key: "dating",
    label: "Rencontres",
    items: [
      {
        title: "Plus de matchs",
        description:
          "Sur les apps de rencontre, l'apparence compte environ 9 fois plus que la bio.",
        source:
          "Witmer, J., Rosenbusch, H., and Meral, E. O. (2025). Computers in Human Behavior Reports.",
      },
      {
        title: "Plus de deuxiemes rendez-vous",
        description:
          "Dans les etudes de speed-dating, l'apparence predit regulierement le succes.",
        source:
          "Eastwick, P. W., and Finkel, E. J. (2008). Journal of Personality and Social Psychology; Luo, S., and Zhang, G. (2009).",
      },
      {
        title: "Partenaires plus desirables",
        description:
          "Les gens finissent generalement avec quelqu'un de leur ligue, cote apparence.",
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
    label: "Sante",
    items: [
      {
        title: "Meilleure prise en charge",
        description:
          "Les medecins manquent 3.67 fois plus de diagnostics pour les patients juges peu attirants.",
        source:
          "Tsiga, E., Panagopoulou, E., and Benos, A. (2016). European Journal for Person Centered Healthcare.",
      },
      {
        title: "Mode de vie plus sain",
        description:
          "Les activites qui te rendent plus attirant sont souvent bonnes pour toi.",
        source:
          "Arnocky, S., and Davis, A. C. (2024). Frontiers in Psychology.",
      },
      {
        title: "Vies plus longues",
        description:
          "Les personnes attirantes vivent plus longtemps (peut-etre en partie grace aux raisons ci-dessus).",
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
        title: "Meilleure prise en charge",
        description:
          "Les medecins manquent 3.67 fois plus de diagnostics pour les patients juges peu attirants.",
        source:
          "Tsiga, E., Panagopoulou, E., and Benos, A. (2016). European Journal for Person Centered Healthcare.",
      },
      {
        title: "Mode de vie plus sain",
        description:
          "Les activites qui te rendent plus attirant sont souvent bonnes pour toi.",
        source:
          "Arnocky, S., and Davis, A. C. (2024). Frontiers in Psychology.",
      },
      {
        title: "Vies plus longues",
        description:
          "Les personnes attirantes vivent plus longtemps (peut-etre en partie grace aux raisons ci-dessus).",
        source:
          "Henderson, J.J.A., and Anglin, J.M. (2003). Evolution and Human Behavior.",
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
          "Les personnes attirantes sont moins susceptibles d'etre arretees.",
        source:
          "Beaver, K. M., Boccio, C., Smith, S., and Ferguson, C. J. (2019). Psychiatry, Psychology and Law.",
      },
      {
        title: "Moins de condamnations",
        description:
          "Les personnes attirantes sont moins susceptibles d'etre condamnees.",
        source:
          "Beaver, K. M., Boccio, C., Smith, S., and Ferguson, C. J. (2019). Psychiatry, Psychology and Law.",
      },
      {
        title: "Peines plus legeres",
        description:
          "En cas de condamnation, les personnes attirantes recoivent des peines plus legeres.",
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

type HeroBottomCard = {
  title: string;
  toneClass: string;
  overlayImageUrl?: string;
  overlayImageAlt?: string;
  overlayImageClass?: string;
};

const heroBottomCards: HeroBottomCard[] = [
  {
    title: "La Réalité du Beauty Privilege",
    toneClass: "bg-[#dbeafe]",
  },
  {
    title: "Analyser mon visage",
    toneClass: "bg-[#d6e4ff]",
  },
  {
    title: "Classement Mondial",
    toneClass: "bg-[#dff3ff]",
    overlayImageUrl: "/map1.png",
    overlayImageAlt: "Globe noir et blanc",
    overlayImageClass:
      "absolute left-1/2 top-[2%] z-10 w-[92%] -translate-x-1/2 opacity-95 grayscale contrast-125 [clip-path:inset(0_0_20%_0)]",
  },
];

export default function Landing() {
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

  return (
    <div className="landing-grain min-h-screen bg-background relative">
      <FloatingHeader />

      {/* Hero Section */}
      <section className="hero-bg-grain relative isolate overflow-hidden min-h-[100svh] px-4 pt-28 pb-6 bg-[#020202]">
        <div className="relative mx-auto flex min-h-[calc(100svh-8.5rem)] w-full lg:max-w-[75%] flex-col justify-between md:min-h-[calc(100svh-9.5rem)]">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10 mx-auto w-full max-w-4xl pt-6 md:pt-10"
          >
            <div className="text-center max-w-4xl mx-auto space-y-6">
              <motion.h1
                variants={itemVariants}
                className="font-display text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight text-balance"
              >
                Glow-Up
                <span className="block">Sans Chirurgie</span>
              </motion.h1>

              <motion.h2
                variants={itemVariants}
                className="mx-auto max-w-2xl text-base md:text-xl font-normal leading-snug tracking-tight text-zinc-400"
              >
                <a
                  href="#appearance-impact"
                  className="transition-colors hover:text-zinc-300"
                >
                  Ceux qui t'ont dit que l'apparence
                  <span className="block">ne comptait pas t'ont mentis</span>
                </a>
              </motion.h2>
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10 mt-8 rounded-[2rem] border border-white/70 bg-[#f1f1f1] p-3 shadow-[0_45px_120px_-80px_rgba(0,0,0,0.98)]"
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {heroBottomCards.map((card) => (
                <article
                  key={card.title}
                  className="overflow-hidden rounded-[1.3rem] border border-black/10 bg-white"
                >
                  <div className={`relative h-40 overflow-hidden ${card.toneClass}`}>
                    {card.overlayImageUrl ? (
                      <img
                        src={card.overlayImageUrl}
                        alt={card.overlayImageAlt ?? card.title}
                        loading="lazy"
                        className={card.overlayImageClass}
                      />
                    ) : null}

                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/12 to-transparent" />
                  </div>

                  <div className="flex items-center justify-between gap-3 px-4 py-4">
                    <p className="text-lg font-semibold tracking-tight text-[#1b1b1b]">
                      {card.title}
                    </p>
                    <ArrowRight className="h-5 w-5 shrink-0 text-[#1b1b1b]" />
                  </div>
                </article>
              ))}
            </div>
          </motion.div>

          <motion.a
            href="#complete-analysis"
            aria-label="Descendre vers la section suivante"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: [0, 5, 0] }}
            transition={{
              opacity: { duration: 0.35, delay: 0.25 },
              y: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
            }}
            className="mt-6 flex justify-center text-foreground/70 hover:text-foreground transition-colors"
          >
            <ChevronDown className="h-9 w-9" strokeWidth={1.8} />
          </motion.a>
        </div>
      </section>

      {/* Complete Analysis Section */}
      <section
        id="complete-analysis"
        className="pt-20 md:pt-28 pb-0 px-4 bg-[linear-gradient(180deg,#000000_0%,#070d17_18%,#10233a_46%,#1a3559_72%,#c7dbf7_100%)]"
      >
        <div className="w-full lg:max-w-[75%] mx-auto">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="relative z-30 flex flex-col items-center text-center gap-10"
          >
            <motion.h2
              variants={itemVariants}
              className="font-display text-3xl md:text-5xl font-bold leading-[1.1] tracking-tight text-balance"
            >
              Your Complete Facial Analysis
            </motion.h2>

            <motion.div variants={itemVariants} className="w-full max-w-2xl">
              <img
                src="/model1.png"
                alt="Your complete facial analysis model"
                loading="lazy"
                className="mx-auto block h-auto w-full object-contain select-none"
              />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Appearance Impact Section */}
      <section
        id="appearance-impact"
        className="py-20 md:py-28 px-4 bg-gradient-to-b from-[#101114] via-[#0c0d0f] to-[#090909]"
      >
        <div className="w-full lg:max-w-[75%] mx-auto">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            className="space-y-8"
          >
            <motion.h2
              variants={itemVariants}
              className="text-center font-display text-3xl md:text-5xl font-bold leading-[1.1] tracking-tight text-balance"
            >
              Ceux qui t'ont dit que l'apparence
              <span className="block">ne comptait pas t'ont mentis</span>
            </motion.h2>

            <motion.div variants={itemVariants} className="w-full">
              <Tabs defaultValue="finances" className="w-full">
                <div className="overflow-x-auto pb-3">
                  <TabsList className="h-auto min-w-full w-max rounded-2xl border border-white/10 bg-black/35 p-1.5 backdrop-blur-sm">
                    {appearanceImpactCategories.map((category) => (
                      <TabsTrigger
                        key={category.key}
                        value={category.key}
                        className="rounded-xl px-4 py-2 text-sm md:text-base"
                      >
                        {category.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {appearanceImpactCategories.map((category) => (
                  <TabsContent key={category.key} value={category.key}>
                    <div className="grid gap-4 md:grid-cols-2">
                      {category.items.map((item) => (
                        <article
                          key={`${category.key}-${item.title}`}
                          className="rounded-2xl border border-white/10 bg-black/30 p-4 md:p-5"
                        >
                          <h3 className="font-display text-lg md:text-xl font-semibold tracking-tight text-foreground">
                            {item.title}
                          </h3>
                          <p className="mt-2 text-sm md:text-base leading-relaxed text-foreground/90">
                            {item.description}
                          </p>
                          <p className="mt-3 text-xs md:text-sm leading-relaxed text-muted-foreground">
                            {item.source}
                          </p>
                        </article>
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/80 bg-secondary/40">
        <div className="w-full lg:max-w-[75%] mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
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
                href="/mentions-legales"
                className="hover:text-primary transition-colors"
              >
                Mentions Légales
              </Link>
              <Link
                href="/cgu"
                className="hover:text-primary transition-colors"
              >
                CGU
              </Link>
              <Link
                href="/confidentialite"
                className="hover:text-primary transition-colors"
              >
                Confidentialité
              </Link>
            </nav>

            <p className="text-sm text-muted-foreground">
              © 2026 ScoreMax. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

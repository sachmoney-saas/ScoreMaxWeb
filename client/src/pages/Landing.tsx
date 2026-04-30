import * as React from "react";
import { Link } from "wouter";
import { WaveBackground } from "@/components/background/WaveBackground";
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

function ScoreProgressSection() {
  const currentScore = 6.42;
  const potentialScore = 7.35;
  const chartWidth = 860;
  const chartHeight = 360;
  const plotLeft = 62;
  const plotRight = 24;
  const plotTop = 56;
  const plotBottom = 66;
  const plotWidth = chartWidth - plotLeft - plotRight;
  const plotHeight = chartHeight - plotTop - plotBottom;
  const xMin = 0;
  const xMax = 10;

  const xToPixel = (x: number) =>
    plotLeft + ((x - xMin) / (xMax - xMin)) * plotWidth;
  const yToPixel = (y: number) => plotTop + (1 - y) * plotHeight;
  const gaussian = (x: number) => {
    const peak = Math.exp(-Math.pow(x - 5.05, 2) / (2 * Math.pow(0.86, 2)));
    // Keep realistic non-zero tails on both sides.
    const leftTail = 0.085 / (1 + Math.exp((x - 2.35) * 2.1));
    const rightTail = 0.075 / (1 + Math.exp((7.25 - x) * 1.8));
    const shoulder = 0.018 * Math.exp(-Math.pow(x - 8.9, 2) / (2 * Math.pow(1.05, 2)));
    return Math.min(1, peak + leftTail + rightTail + shoulder);
  };

  const curvePoints = Array.from({ length: 120 }, (_, index) => {
    const x = xMin + (index / 119) * (xMax - xMin);
    return `${xToPixel(x).toFixed(2)},${yToPixel(gaussian(x)).toFixed(2)}`;
  }).join(" ");

  const currentX = xToPixel(currentScore);
  const potentialX = xToPixel(potentialScore);

  return (
    <section className="bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.17),transparent_36%),radial-gradient(circle_at_78%_72%,rgba(185,204,209,0.16),transparent_44%),linear-gradient(145deg,rgba(10,16,22,0.94)_0%,rgba(20,31,39,0.9)_48%,rgba(185,204,209,0.3)_100%)] px-4 py-16 md:py-24">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-[2.2rem] border border-white/15 bg-black/30 p-6 shadow-[0_24px_90px_-58px_rgba(0,0,0,0.85)] backdrop-blur-sm md:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-4xl leading-tight tracking-tight text-white md:text-6xl">
              Your score isn't fixed
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 md:text-3xl">
              Small, consistent changes compound over time. Track your progress and
              watch your score move.
            </p>
          </div>

          <div className="mt-14 flex items-end justify-center gap-6 text-center md:gap-12">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-zinc-500">
                Today
              </p>
              <p className="mt-4 font-display text-6xl tracking-tight text-zinc-500 md:text-7xl">
                {currentScore.toFixed(2)}
              </p>
            </div>
            <div className="pb-4 text-5xl text-zinc-600 md:text-6xl">→</div>
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-zinc-400">
                Potential
              </p>
              <p className="mt-4 font-display text-6xl tracking-tight text-white md:text-7xl">
                {potentialScore.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-10 overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="mx-auto min-w-[760px] text-[#aab2bd]"
              role="img"
              aria-label="Score distribution chart"
            >
              {[0.2, 0.4, 0.6, 0.8, 1].map((value) => (
                <line
                  key={`grid-${value}`}
                  x1={plotLeft}
                  y1={yToPixel(value)}
                  x2={plotLeft + plotWidth}
                  y2={yToPixel(value)}
                  stroke="#384253"
                  strokeWidth="1"
                />
              ))}

              <line
                x1={plotLeft}
                y1={plotTop + plotHeight}
                x2={plotLeft + plotWidth}
                y2={plotTop + plotHeight}
                stroke="#556377"
                strokeWidth="1"
              />

              <polyline
                points={curvePoints}
                fill="none"
                stroke="#96a3b4"
                strokeWidth="2.8"
              />

              <line
                x1={currentX}
                y1={plotTop}
                x2={currentX}
                y2={plotTop + plotHeight}
                stroke="#a8b492"
                strokeWidth="3"
              />
              <line
                x1={potentialX}
                y1={plotTop}
                x2={potentialX}
                y2={plotTop + plotHeight}
                stroke="#9cc5a9"
                strokeWidth="1.6"
                strokeDasharray="5 5"
              />

              <rect
                x={currentX - 56}
                y={plotTop - 30}
                width="116"
                height="26"
                rx="13"
                fill="#2f3b2d"
                stroke="#8ea27e"
              />
              <text
                x={currentX + 2}
                y={plotTop - 13}
                textAnchor="middle"
                fontSize="11"
                fill="#c0d0b3"
                fontWeight="600"
              >
                6.42 · Top 17.0%
              </text>

              <text
                x={(currentX + potentialX) / 2 + 6}
                y={plotTop + plotHeight - 2}
                transform={`rotate(-90 ${(currentX + potentialX) / 2 + 6} ${plotTop + plotHeight - 2})`}
                fontSize="28"
                fill="#a6c0ab"
                fontWeight="500"
                letterSpacing="0.06em"
              >
                IMPROVEMENT
              </text>

              {[0, 10, 20, 30, 40].map((tick, index) => (
                <text
                  key={`ytick-${tick}`}
                  x={plotLeft - 10}
                  y={yToPixel(index / 4) + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="#7f8ea1"
                >
                  {tick}
                </text>
              ))}

              <text
                x={22}
                y={plotTop + plotHeight / 2}
                transform={`rotate(-90 22 ${plotTop + plotHeight / 2})`}
                textAnchor="middle"
                fontSize="12"
                fill="#7f8ea1"
                letterSpacing="0.08em"
                fontWeight="500"
              >
                POPULATION DENSITY
              </text>

              {Array.from({ length: 11 }, (_, index) => (
                <text
                  key={`tick-${index}`}
                  x={xToPixel(index)}
                  y={plotTop + plotHeight + 22}
                  textAnchor="middle"
                  fontSize="14"
                  fill="#8f9caf"
                >
                  {index}
                </text>
              ))}

              <text
                x={plotLeft + plotWidth / 2}
                y={chartHeight - 10}
                textAnchor="middle"
                fontSize="12"
                fill="#8d9bad"
                letterSpacing="0.15em"
                fontWeight="600"
              >
                OVERALL SCORE
              </text>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

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
      <section className="relative isolate min-h-[100svh] overflow-hidden bg-[radial-gradient(circle_at_25%_10%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.92)_0%,rgba(20,31,39,0.88)_48%,rgba(185,204,209,0.28)_100%)] px-4 pb-6 pt-28">
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
                Ceux qui t'ont dit que l'apparence
                <span className="block">ne comptait pas t'ont mentis</span>
              </motion.h1>
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10 mt-8 rounded-[2rem] border border-white/70 bg-[#f1f1f1] p-3 shadow-[0_45px_120px_-80px_rgba(0,0,0,0.98)]"
          >
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {heroBottomCards.map((card) => (
                <article
                  key={card.title}
                  className="overflow-hidden rounded-2xl border border-black/10 bg-white"
                >
                  <div
                    className={`relative h-20 overflow-hidden sm:h-24 md:h-28 lg:h-32 ${card.toneClass}`}
                  >
                    {card.overlayImageUrl ? (
                      <img
                        src={card.overlayImageUrl}
                        alt={card.overlayImageAlt ?? card.title}
                        loading="lazy"
                        className={`${card.overlayImageClass ?? ""} scale-[1.03]`}
                      />
                    ) : null}

                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/12 to-transparent" />
                  </div>

                  <div className="flex min-h-[54px] items-center justify-between gap-2 px-2.5 py-2 sm:min-h-[60px] sm:px-3 sm:py-2.5 md:min-h-[68px] md:px-4 md:py-3">
                    <p className="line-clamp-2 text-[11px] font-semibold leading-tight tracking-tight text-[#1b1b1b] sm:text-xs md:text-sm lg:text-base">
                      {card.title}
                    </p>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#1b1b1b] sm:h-4 sm:w-4 md:h-5 md:w-5" />
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
        className="relative flex min-h-[100svh] overflow-hidden bg-[radial-gradient(circle_at_32%_18%,rgba(255,255,255,0.12),transparent_34%),linear-gradient(145deg,rgba(10,16,22,0.9)_0%,rgba(22,33,42,0.86)_48%,rgba(170,194,201,0.24)_100%)] px-4 pt-20 md:pt-28"
      >
        <WaveBackground position="absolute" className="!h-full !w-full" />
        <div className="relative z-10 flex min-h-[calc(100svh-5rem)] w-full flex-col justify-end lg:max-w-[75%] mx-auto md:min-h-[calc(100svh-7rem)]">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="relative z-30 flex flex-1 flex-col items-center justify-between gap-10 text-center"
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

      <ScoreProgressSection />

      {/* Appearance Impact Section */}
      <section
        id="appearance-impact"
        className="bg-[radial-gradient(circle_at_72%_24%,rgba(255,255,255,0.14),transparent_34%),radial-gradient(circle_at_24%_82%,rgba(185,204,209,0.13),transparent_40%),linear-gradient(145deg,rgba(10,16,22,0.93)_0%,rgba(20,31,39,0.89)_48%,rgba(185,204,209,0.29)_100%)] px-4 py-20 md:py-28"
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

      {/* Who This Is For Section */}
      <section className="bg-[radial-gradient(circle_at_50%_42%,rgba(120,145,168,0.16),transparent_42%),linear-gradient(180deg,rgba(6,10,16,0.96)_0%,rgba(4,7,12,0.98)_100%)] px-4 py-24 md:py-32">
        <div className="mx-auto w-full max-w-4xl text-center">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            className="space-y-7"
          >
            <motion.div
              variants={itemVariants}
              className="mx-auto h-px w-8 bg-white/20"
            />

            <motion.p
              variants={itemVariants}
              className="text-[11px] font-semibold uppercase tracking-[0.34em] text-zinc-500"
            >
              A note on who this is for
            </motion.p>

            <motion.h2
              variants={itemVariants}
              className="font-display text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl"
            >
              This isn't for everyone
            </motion.h2>

            <motion.p
              variants={itemVariants}
              className="mx-auto max-w-3xl text-lg leading-relaxed text-zinc-400 md:text-3xl"
            >
              Most people see their score and do nothing. They let the number
              define them. The ones who actually transform treat it as a
              starting point - and commit to the process.
            </motion.p>

            <motion.p
              variants={itemVariants}
              className="text-base leading-relaxed text-zinc-500 md:text-xl"
            >
              ScoreMax is built for them.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="mx-auto h-px w-8 bg-white/20"
            />
          </motion.div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-[radial-gradient(circle_at_50%_30%,rgba(170,188,208,0.2),transparent_42%),linear-gradient(180deg,rgba(216,223,232,0.98)_0%,rgba(202,211,223,0.96)_100%)] px-4 py-24 md:py-32">
        <div className="mx-auto w-full max-w-5xl text-center">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.22 }}
            className="space-y-8"
          >
            <motion.h2
              variants={itemVariants}
              className="mx-auto max-w-4xl font-display text-4xl font-bold leading-tight tracking-tight text-[#141822] md:text-7xl"
            >
              Your transformation starts with a first analysis
            </motion.h2>

            <motion.p
              variants={itemVariants}
              className="mx-auto max-w-3xl text-lg leading-relaxed text-[#5f6c7e] md:text-3xl"
            >
              450,000+ people have already started their journey.
              The only question left is - will you?
            </motion.p>

            <motion.div variants={itemVariants} className="pt-2">
              <Link href="/register">
                <Button className="h-16 rounded-full bg-[#0f1219] px-10 text-lg font-semibold text-white shadow-[0_28px_65px_-35px_rgba(0,0,0,0.65)] hover:bg-black">
                  Begin Your First Analysis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </motion.div>

            <motion.p
              variants={itemVariants}
              className="text-base leading-relaxed text-[#8d98a8] md:text-xl"
            >
              Your future self will thank you.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.12),transparent_36%),radial-gradient(circle_at_18%_78%,rgba(185,204,209,0.11),transparent_42%),linear-gradient(145deg,rgba(10,16,22,0.94)_0%,rgba(20,31,39,0.9)_48%,rgba(185,204,209,0.26)_100%)] py-12">
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

import * as React from "react";
import { Link } from "wouter";
import { WaveBackground } from "@/components/background/WaveBackground";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { i18n, useAppLanguage, type AppLanguage } from "@/lib/i18n";

function FloatingHeader({ language }: { language: AppLanguage }) {
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
                  {i18n(language, { en: "Login", fr: "Connexion" })}
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="sm"
                  className="rounded-full px-6 shadow-lg shadow-primary/20"
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
      "Salaire plus eleve": {
        title: "Higher income",
        description: "Attractive people earn 10-15% more.",
      },
      "Entretiens d'embauche facilites": {
        title: "Easier hiring outcomes",
        description: "Attractive candidates are perceived as more qualified.",
      },
      "Pourboires plus eleves": {
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
      "Plus de deuxiemes rendez-vous": {
        title: "More second dates",
        description:
          "In speed-dating studies, appearance consistently predicts success.",
      },
      "Partenaires plus desirables": {
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
      "Peines plus legeres": {
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

function ScoreProgressSection({ language }: { language: AppLanguage }) {
  const measureRef = React.useRef<HTMLDivElement>(null);
  const [naturalHeight, setNaturalHeight] = React.useState(0);
  const [scale, setScale] = React.useState(1);

  const updateFit = React.useCallback(() => {
    const el = measureRef.current;
    if (!el) return;
    const natural = el.scrollHeight;
    if (natural <= 0) return;
    const maxH = window.visualViewport?.height ?? window.innerHeight;
    setNaturalHeight(natural);
    setScale(Math.min(1, maxH / natural));
  }, []);

  React.useLayoutEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) updateFit();
    };
    run();
    void document.fonts?.ready?.then(run);
    const el = measureRef.current;
    const vv = window.visualViewport;
    vv?.addEventListener("resize", run);
    window.addEventListener("resize", run);
    const ro = new ResizeObserver(run);
    if (el) ro.observe(el);
    return () => {
      cancelled = true;
      vv?.removeEventListener("resize", run);
      window.removeEventListener("resize", run);
      ro.disconnect();
    };
  }, [updateFit, language]);

  const currentScore = 6.42;
  const potentialScore = 7.35;
  const chartWidth = 620;
  const chartHeight = 280;
  const plotLeft = 48;
  const plotRight = 14;
  const plotTop = 44;
  const plotBottom = 52;
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

  const shellHeight =
    naturalHeight > 0 ? Math.ceil(naturalHeight * scale) : undefined;

  return (
    <section className="max-h-[100svh] overflow-hidden bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.17),transparent_36%),radial-gradient(circle_at_78%_72%,rgba(185,204,209,0.16),transparent_44%),linear-gradient(145deg,rgba(10,16,22,0.94)_0%,rgba(20,31,39,0.9)_48%,rgba(185,204,209,0.3)_100%)] px-4">
      <div
        className="mx-auto w-full max-w-5xl"
        style={{
          height: shellHeight,
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top center",
            willChange: "transform",
          }}
        >
          <div ref={measureRef} className="py-16 md:py-24">
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
                    {i18n(language, { en: "Today", fr: "Aujourd'hui" })}
                  </p>
                  <p className="mt-4 font-display text-6xl tracking-tight text-zinc-500 md:text-7xl">
                    {currentScore.toFixed(2)}
                  </p>
                </div>
                <div className="pb-4 text-5xl text-zinc-600 md:text-6xl">→</div>
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.16em] text-zinc-400">
                    {i18n(language, { en: "Potential", fr: "Potentiel" })}
                  </p>
                  <p className="mt-4 font-display text-6xl tracking-tight text-white md:text-7xl">
                    {potentialScore.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-10 w-full min-w-0">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="mx-auto block h-auto w-full max-w-full text-[#aab2bd]"
                  preserveAspectRatio="xMidYMid meet"
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
                fontSize="20"
                fill="#a6c0ab"
                fontWeight="500"
                letterSpacing="0.06em"
              >
                {i18n(language, { en: "IMPROVEMENT", fr: "PROGRESSION" })}
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
                {i18n(language, { en: "POPULATION DENSITY", fr: "DENSITE DE POPULATION" })}
              </text>

              {Array.from({ length: 11 }, (_, index) => (
                <text
                  key={`tick-${index}`}
                  x={xToPixel(index)}
                  y={plotTop + plotHeight + 22}
                  textAnchor="middle"
                  fontSize="11"
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
                {i18n(language, { en: "OVERALL SCORE", fr: "SCORE GLOBAL" })}
              </text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const language = useAppLanguage();
  const localizedAppearanceImpactCategories = React.useMemo(
    () =>
      appearanceImpactCategories.map((category) => ({
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
      <FloatingHeader language={language} />

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
                {i18n(language, {
                  en: "Beauty can be",
                  fr: "La beauté peut être",
                })}
                <span className="block">
                  {i18n(language, {
                    en: "measured and improved",
                    fr: "mesurée et améliorée",
                  })}
                </span>
              </motion.h1>
            </div>
          </motion.div>

          <motion.a
            href="#complete-analysis"
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

      <ScoreProgressSection language={language} />

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
              {i18n(language, {
                en: "Beauty can be",
                fr: "La beauté peut être",
              })}
              <span className="block">
                {i18n(language, {
                  en: "measured and improved",
                  fr: "mesurée et améliorée",
                })}
              </span>
            </motion.h2>

            <motion.div variants={itemVariants} className="w-full">
              <Tabs defaultValue="finances" className="w-full">
                <div className="overflow-x-auto pb-3">
                  <TabsList className="h-auto min-w-full w-max rounded-2xl border border-white/10 bg-black/35 p-1.5 backdrop-blur-sm">
                    {localizedAppearanceImpactCategories.map((category) => (
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

                {localizedAppearanceImpactCategories.map((category) => (
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
              {i18n(language, {
                en: "A note on who this is for",
                fr: "Une note sur le profil visé",
              })}
            </motion.p>

            <motion.h2
              variants={itemVariants}
              className="font-display text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl"
            >
              {i18n(language, {
                en: "This isn't for everyone",
                fr: "Ce n'est pas pour tout le monde",
              })}
            </motion.h2>

            <motion.p
              variants={itemVariants}
              className="mx-auto max-w-3xl text-lg leading-relaxed text-zinc-400 md:text-3xl"
            >
              {i18n(language, {
                en: "Most people see their score and do nothing. They let the number define them. The ones who actually transform treat it as a starting point - and commit to the process.",
                fr: "La plupart voient leur score et ne font rien. Ils laissent ce nombre les définir. Ceux qui se transforment vraiment le prennent comme un point de départ et s'engagent dans le processus.",
              })}
            </motion.p>

            <motion.p
              variants={itemVariants}
              className="text-base leading-relaxed text-zinc-500 md:text-xl"
            >
              {i18n(language, {
                en: "ScoreMax is built for them.",
                fr: "ScoreMax est conçu pour eux.",
              })}
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
              {i18n(language, {
                en: "Your transformation starts with a first analysis",
                fr: "Ta transformation commence par une première analyse",
              })}
            </motion.h2>

            <motion.p
              variants={itemVariants}
              className="mx-auto max-w-3xl text-lg leading-relaxed text-[#5f6c7e] md:text-3xl"
            >
              {i18n(language, {
                en: "450,000+ people have already started their journey. The only question left is - will you?",
                fr: "450 000+ personnes ont déjà commencé leur parcours. La seule question restante : et toi ?",
              })}
            </motion.p>

            <motion.div variants={itemVariants} className="pt-2">
              <Link href="/register">
                <Button className="h-16 rounded-full bg-[#0f1219] px-10 text-lg font-semibold text-white shadow-[0_28px_65px_-35px_rgba(0,0,0,0.65)] hover:bg-black">
                  {i18n(language, {
                    en: "Begin Your First Analysis",
                    fr: "Commence ta première analyse",
                  })}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </motion.div>

            <motion.p
              variants={itemVariants}
              className="text-base leading-relaxed text-[#8d98a8] md:text-xl"
            >
              {i18n(language, {
                en: "Your future self will thank you.",
                fr: "Ton futur toi te remerciera.",
              })}
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
                {i18n(language, {
                  en: "Legal Notice",
                  fr: "Mentions Légales",
                })}
              </Link>
              <Link
                href="/cgu"
                className="hover:text-primary transition-colors"
              >
                {i18n(language, {
                  en: "Terms",
                  fr: "CGU",
                })}
              </Link>
              <Link
                href="/confidentialite"
                className="hover:text-primary transition-colors"
              >
                {i18n(language, {
                  en: "Privacy",
                  fr: "Confidentialité",
                })}
              </Link>
            </nav>

            <p className="text-sm text-muted-foreground">
              {i18n(language, {
                en: "© 2026 ScoreMax. All rights reserved.",
                fr: "© 2026 ScoreMax. Tous droits réservés.",
              })}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

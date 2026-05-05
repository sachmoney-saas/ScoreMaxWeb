import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { i18n, useAppLanguage } from "@/lib/i18n";

/** V1 — document d’information ; faire relire par un juriste avant mise en production « définitive ». */
const TERMS_EFFECTIVE_DATE = { en: "5 May 2026", fr: "5 mai 2026" };

export default function CGU() {
  const language = useAppLanguage();
  const tx = (en: string, fr: string) => i18n(language, { en, fr });

  return (
    <LegalPageShell
      current="terms"
      title={i18n(language, {
        en: "Terms of service",
        fr: "Conditions générales d'utilisation",
      })}
    >
      <p className="-mt-4 text-sm font-medium text-zinc-500">
        {tx("Effective date:", "Date d'effet :")}{" "}
        {i18n(language, TERMS_EFFECTIVE_DATE)}
      </p>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("1. Operator", "1. Opérateur du service")}
        </h2>
        <p>
          {tx(
            'The ScoreMax website and application (the "Service") are published and operated by ScoreMax SAS, a French simplified joint-stock company with its registered office at 123 Rue de la Tech, 75001 Paris, France ("ScoreMax", "we", "us").',
            'Le site et l’application ScoreMax (le « Service ») sont édités et exploités par la société ScoreMax SAS, société par actions simplifiée au capital social (le cas échéant) indiqué dans nos mentions légales, dont le siège social est situé 123 Rue de la Tech, 75001 Paris, France (« ScoreMax », « nous »).',
          )}
        </p>
        <p>
          {tx(
            "For any question about these Terms: contact@scoremax.fr",
            "Pour toute question relative aux présentes CGU : contact@scoremax.fr",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("2. Description of the Service", "2. Description du Service")}
        </h2>
        <p>
          {tx(
            "ScoreMax offers tools for facial analysis based on photos you provide: automated measurements, dimensionless or relative scores, and personalised recommendations or protocol-style content designed to help you track progress over time. The Service may include account features, history of analyses, onboarding capture flows, and optional paid plans.",
            "ScoreMax propose des outils d’analyse faciale à partir de clichés que vous fournissez : mesures automatisées, scores adimensionnels ou relatifs, ainsi que des recommandations ou contenus de type protocole visant à faciliter le suivi de votre progression dans le temps. Le Service peut inclure un compte utilisateur, un historique d’analyses, des parcours de capture (onboarding) et des offres payantes éventuelles.",
          )}
        </p>
        <p>
          {tx(
            "Analysis is performed by software (including remote processing). Results depend on image quality, capture conditions, and algorithmic models. The Service may evolve (features, availability, pricing).",
            "Les analyses sont réalisées par des logiciels (y compris un traitement à distance). Les résultats dépendent de la qualité des images, des conditions de prise de vue et des modèles algorithmiques. Le Service peut évoluer (fonctionnalités, disponibilité, tarification).",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("3. Acceptance and eligibility", "3. Acceptation et éligibilité")}
        </h2>
        <p>
          {tx(
            "By creating an account or using the Service, you confirm that you have read these Terms and our Privacy Policy and that you agree to them. If you disagree, you must not use the Service.",
            "En créant un compte ou en utilisant le Service, vous confirmez avoir pris connaissance des présentes CGU et de notre politique de confidentialité, et les accepter. À défaut, vous ne devez pas utiliser le Service.",
          )}
        </p>
        <p>
          {tx(
            "You must be at least eighteen (18) years of age, or the age of majority in your jurisdiction if higher. You may not use the Service on behalf of a minor.",
            "Vous devez avoir au moins dix-huit (18) ans révolus, ou l’âge de la majorité dans votre pays si celui-ci est supérieur. Vous ne pouvez pas utiliser le Service pour le compte d’un mineur.",
          )}
        </p>
        <p>
          {tx(
            "Certain flows (e.g. acceptance of terms in-app) may be required before full access. You are responsible for activity under your account.",
            "Certains parcours (par ex. acceptation des conditions dans l’application) peuvent être requis avant un accès complet. Vous êtes responsable de l’activité réalisée sous votre compte.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("4. Account", "4. Compte utilisateur")}
        </h2>
        <p>
          {tx(
            "You agree to provide accurate, up-to-date registration information and to maintain the confidentiality of your credentials. You must notify us promptly of any unauthorised use.",
            "Vous vous engagez à fournir des informations d’inscription exactes et à jour et à préserver la confidentialité de vos identifiants. Vous devez nous informer sans délai en cas d’utilisation non autorisée.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx(
            "5. Acceptable use and facial imagery",
            "5. Usage acceptable et images du visage",
          )}
        </h2>
        <p>{tx("You agree not to:", "Vous vous engagez à ne pas :")}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            {tx(
              "use the Service for unlawful purposes, to harm others, or to circumvent security or quotas;",
              "utiliser le Service à des fins illicites, pour nuire à autrui, ou pour contourner des mesures de sécurité ou des quotas ;",
            )}
          </li>
          <li>
            {tx(
              "upload images of another person without their explicit consent, or images of minors;",
              "téléverser des images d’autrui sans son consentement explicite, ou des images de mineurs ;",
            )}
          </li>
          <li>
            {tx(
              "upload malware, illegal content, or content that infringes third-party rights;",
              "téléverser des contenus illicites, des malwares ou des éléments portant atteinte aux droits de tiers ;",
            )}
          </li>
          <li>
            {tx(
              "reverse engineer or attempt to extract our models or data except where mandatory law allows;",
              "procéder à de l’ingénierie inverse ou tenter d’extraire nos modèles ou données, sauf si la loi applicable l’impose ;",
            )}
          </li>
          <li>
            {tx(
              "resell, publicly redistribute, or misrepresent analysis outputs as professional clinical opinions.",
              "revendre, redistribuer publiquement ou présenter les résultats d’analyse comme des avis cliniques professionnels.",
            )}
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("6. Licence on content you upload", "6. Licence sur vos contenus")}
        </h2>
        <p>
          {tx(
            "You retain ownership of photos and other content you submit. You grant ScoreMax a non-exclusive licence to host, process, analyse, display to you, and technically adapt such content solely to operate, secure, and improve the Service, as further described in our Privacy Policy.",
            "Vous restez propriétaire des photos et autres contenus que vous soumettez. Vous concédez à ScoreMax une licence non exclusive pour les héberger, les traiter, les analyser, vous les afficher et les adapter techniquement, uniquement pour exploiter, sécuriser et améliorer le Service, dans les limites précisées dans notre politique de confidentialité.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx(
            "7. Not medical or professional advice",
            "7. Absence de conseil médical ou professionnel",
          )}
        </h2>
        <p>
          {tx(
            "ScoreMax does not provide medical, surgical, dermatological, orthodontic, psychological, or other regulated professional advice. Outputs are generated automatically for general information and self-tracking. They do not replace a consultation with a qualified professional.",
            "ScoreMax ne fournit pas de conseil médical, chirurgical, dermatologique, orthodontique, psychologique ou autre conseil professionnel réglementé. Les résultats sont produits automatiquement à titre d’information générale et d’auto-suivi. Ils ne remplacent pas une consultation avec un professionnel qualifié.",
          )}
        </p>
        <p>
          {tx(
            "Before any aesthetic, medical, or surgical decision, you must consult an appropriate licensed practitioner. You are solely responsible for how you interpret or use the Service.",
            "Avant toute décision esthétique, médicale ou chirurgicale, vous devez consulter un professionnel habilité. Vous demeurez seul responsable de l’interprétation et de l’usage que vous faites du Service.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx(
            "8. Scores, recommendations, and limitation of guarantees",
            "8. Scores, recommandations et garanties",
          )}
        </h2>
        <p>
          {tx(
            "Scores and labels are algorithmic summaries; beauty and appearance involve subjective and contextual factors. We do not guarantee accuracy, completeness, fitness for a particular purpose, or a specific real-world outcome.",
            "Les scores et libellés sont des synthèses algorithmiques ; l’esthétique et l’apparence comportent des dimensions subjectives et contextuelles. Nous ne garantissons ni l’exactitude, ni l’exhaustivité, ni l’adéquation à un besoin particulier, ni un résultat concret.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("9. Subscriptions and payments", "9. Abonnements et paiements")}
        </h2>
        <p>
          {tx(
            "Some features may require a paid subscription or one-off payment. Prices, billing cycles, and renewal rules will be presented at purchase. Unless stated otherwise at checkout, failure to pay may result in suspension of paid features. Refund rules follow applicable consumer law and any specific terms shown before payment.",
            "Certaines fonctionnalités peuvent nécessiter un abonnement payant ou un paiement ponctuel. Les prix, la facturation et le renouvellement sont présentés au moment de l’achat. Sauf indication contraire, le défaut de paiement peut entraîner la suspension des fonctions payantes. Les remboursements suivent le droit applicable de la consommation et les conditions affichées avant paiement.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx(
            "10. Intellectual property",
            "10. Propriété intellectuelle",
          )}
        </h2>
        <p>
          {tx(
            "The Service, its branding, software, documentation, and aggregated content (excluding your uploads) belong to ScoreMax or its licensors. Except for the limited rights necessary to use the Service, no licence is granted. You may not copy or exploit our materials without prior written consent.",
            "Le Service, sa marque, ses logiciels, sa documentation et les contenus édités par ScoreMax (hors contenus que vous téléversez) appartiennent à ScoreMax ou à ses concédants. Aucune licence n’est accordée au-delà de l’usage du Service. Vous ne pouvez pas copier ou exploiter nos éléments sans accord écrit préalable.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx(
            "11. Warranty disclaimer and liability cap",
            "11. Exclusion de garanties et limitation de responsabilité",
          )}
        </h2>
        <p>
          {tx(
            'To the fullest extent permitted by law, the Service is provided "as is" and "as available". ScoreMax disclaims implied warranties where allowed. We are not liable for indirect damages (including lost profits, data loss, or reputational harm) except where mandatory law provides otherwise.',
            "Dans toute la mesure permise par la loi, le Service est fourni « en l’état » et « selon disponibilité ». ScoreMax exclut les garanties implicites lorsque le droit le permet. Notre responsabilité pour les dommages indirects (perte de profits, de données ou atteinte à l’image, etc.) est exclue, sauf disposition légale impérative contraire.",
          )}
        </p>
        <p>
          {tx(
            "Where a liability cap is permitted, ScoreMax's aggregate liability per twelve-month period shall not exceed the amounts you paid to ScoreMax for the Service during that period, or one hundred euros (€100) if you only used free features.",
            "Lorsqu’un plafond est admis, le montant total de la responsabilité de ScoreMax sur douze (12) mois ne dépassera pas les sommes payées par vous à ScoreMax pour le Service sur cette période, ou cent euros (100 €) si vous n’avez utilisé que l’offre gratuite.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("12. Indemnity", "12. Garantie d’indemnisation")}
        </h2>
        <p>
          {tx(
            "You agree to indemnify and hold ScoreMax harmless against third-party claims arising from your misuse of the Service, your content, or your breach of these Terms, within the limits permitted by law.",
            "Vous vous engagez à garantir ScoreMax contre les réclamations de tiers résultant d’une utilisation abusive du Service, de vos contenus ou d’une violation des présentes CGU, dans les limites prévues par la loi.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("13. Suspension and termination", "13. Suspension et résiliation")}
        </h2>
        <p>
          {tx(
            "We may suspend or terminate access if you materially breach these Terms, create risk, or if required by law. You may stop using the Service at any time. Provisions that by nature survive termination (e.g. liability limits, IP) will remain in effect.",
            "Nous pouvons suspendre ou mettre fin à l’accès en cas de manquement grave aux présentes CGU, de risque pour le Service ou si la loi l’exige. Vous pouvez cesser d’utiliser le Service à tout moment. Les dispositions qui survivent par nature (limitation de responsabilité, propriété intellectuelle, etc.) demeurent applicables.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("14. Changes", "14. Modifications")}
        </h2>
        <p>
          {tx(
            "We may update these Terms; we will indicate a new effective date on this page. Where the law requires additional formalities (e.g. prior information for consumers), we will comply. Continued use after notice may constitute acceptance.",
            "Nous pouvons mettre à jour les présentes CGU ; une nouvelle date d’effet sera indiquée sur cette page. Lorsque la loi impose des formalités supplémentaires (information préalable des consommateurs, etc.), nous nous y conformerons. La poursuite d’usage après information peut valoir acceptation.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx(
            "15. Applicable law and disputes",
            "15. Droit applicable et litiges",
          )}
        </h2>
        <p>
          {tx(
            "These Terms are governed by French law, without prejudice to mandatory protections that may apply to you as a consumer in your country of residence. Competent courts shall be those provided by the applicable rules, subject to mandatory consumer jurisdictions.",
            "Les présentes CGU sont régies par le droit français, sans préjudice des dispositions impératives qui vous protègent en tant que consommateur dans votre pays de résidence. Les tribunaux compétents sont ceux prévus par les règles applicables, sous réserve des compétences spécifiques en matière de consommation.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("16. Miscellaneous", "16. Divers")}
        </h2>
        <p>
          {tx(
            "If a clause is held invalid, the remainder stays enforceable. These Terms, together with the Privacy Policy, form the contract on use of the Service and supersede prior discussions on the same subject.",
            "Si une clause est jugée invalide, les autres demeurent en vigueur dans la mesure du possible. Les présentes CGU, avec la politique de confidentialité, constituent l’accord relatif à l’usage du Service et se substituent aux échanges antérieurs sur le même objet.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("17. Contact", "17. Contact")}
        </h2>
        <p>
          {tx(
            "ScoreMax SAS — 123 Rue de la Tech, 75001 Paris, France — contact@scoremax.fr",
            "ScoreMax SAS — 123 Rue de la Tech, 75001 Paris, France — contact@scoremax.fr",
          )}
        </p>
      </section>
    </LegalPageShell>
  );
}

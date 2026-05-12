import { Link } from "wouter";
import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { i18n, useAppLanguage } from "@/lib/i18n";

/**
 * V1 — conformité visée LCEN ; complétez obligatoirement RCS/SIRET/TVA lorsque attribués.
 * Faire valider par un juriste avant exposition publique définitive.
 */
const LEGAL_NOTICE_EFFECTIVE_DATE = { en: "5 May 2026", fr: "5 mai 2026" };

export default function MentionsLegales() {
  const language = useAppLanguage();
  const tx = (en: string, fr: string) => i18n(language, { en, fr });

  return (
    <LegalPageShell
      current="legal-notice"
      title={i18n(language, {
        en: "Legal notice",
        fr: "Mentions légales",
      })}
    >
      <p className="-mt-4 text-sm font-medium text-zinc-500">
        {tx("Last updated:", "Dernière mise à jour :")}{" "}
        {i18n(language, LEGAL_NOTICE_EFFECTIVE_DATE)}
      </p>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("1. Publisher of the Site and Application", "1. Éditeur du site et de l’application")}
        </h2>
        <p>
          {tx(
            'The ScoreMax website accessible from your usual URL and its companion mobile or web application (together, the « Site ») are edited by:',
            'Le site web ScoreMax accessible depuis l’URL que vous utilisez habituellement et l’application web ou mobile associée (ensemble, le « Site ») sont édités par :',
          )}
        </p>
        <ul className="mt-3 list-none space-y-2 pl-0">
          <li>
            <strong className="text-zinc-200">{tx("Corporate name:", "Raison sociale :")}</strong>{" "}
            ScoreMax SAS
          </li>
          <li>
            <strong className="text-zinc-200">{tx("Legal form:", "Forme juridique :")}</strong>{" "}
            {tx("French simplified joint-stock company (SAS)", "Société par actions simplifiée (SAS)")}
          </li>
          <li>
            <strong className="text-zinc-200">{tx("Registered office:", "Siège social :")}</strong>{" "}
            123 Rue de la Tech, 75001 Paris, France
          </li>
          <li>
            <strong className="text-zinc-200">{tx("RCS register:", "Immatriculation :")}</strong>{" "}
            {tx(
              "RCS Paris — Company identification numbers (SIREN / SIRET / intra-EU VAT) will be inserted here upon final registration.",
              "RCS Paris — Les numéros d’identification (SIREN, SIRET, TVA intracommunautaire le cas échéant) seront repris ici dès leur attribution définitive.",
            )}
          </li>
          <li>
            <strong className="text-zinc-200">{tx("Publishing director:", "Directeur de la publication :")}</strong>{" "}
            {tx(
              "The legal representative of ScoreMax SAS, unless otherwise communicated in writing.",
              "Le représentant légal de ScoreMax SAS, sauf désignation expresse différente notifiée sur le Site.",
            )}
          </li>
          <li>
            <strong className="text-zinc-200">{tx("Contact:", "Contact :")}</strong>{" "}
            <span className="text-zinc-300">contact@scoremax.fr</span>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("2. Hosting and technical infrastructure", "2. Hébergement et infrastructure technique")}
        </h2>
        <p className="mb-3">
          {tx(
            "The ScoreMax backend and APIs are deployed on scalable cloud hosting. Persistent data (profiles, subscriptions state, analytical metadata) reside in PostgreSQL bases operated by Supabase. User-submitted photographic assets are stored in object storage buckets provided via Cloudflare R2. Automated facial analysis computations may be delegated to specialised remote inference services as described in our Privacy Policy.",
            "Les API et traitements ScoreMax sont exécutés sur une plateforme d’hébergement cloud. Les données comptables et métier (profil, état d’abonnement, métadonnées d’analyses) sont stockées dans des bases PostgreSQL opérées par Supabase. Les clichés téléversés par les utilisateurs sont conservés dans un stockage objet assuré par Cloudflare R2. Les analyses faciales automatisées peuvent être réalisées en tout ou partie par des prestataires d’inférence distante, comme détaillé dans notre politique de confidentialité.",
          )}
        </p>
        <p className="mb-2 font-medium text-zinc-300">{tx("Key processors (non-exhaustive):", "Principaux prestataires (liste non exhaustive) :")}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-zinc-200">Railway Corp.</strong> —{" "}
            {tx(
              "Application hosting (United States — check sub-processor disclosures for geographic regions). Website: railway.com",
              "Hébergement applicatif des services (États-Unis ; se référer aux informations du prestataire sur les régions). Site : railway.com",
            )}
          </li>
          <li>
            <strong className="text-zinc-200">Supabase, Inc.</strong> —{" "}
            {tx(
              "Managed database & authentication backbone. Website: supabase.com — Supabase publishes its company address on its Legal / Trust pages.",
              "Base de données gérée et infrastructure d’authentification. Site : supabase.com — l’adresse légale est publiée sur les pages légales de l’éditeur.",
            )}
          </li>
          <li>
            <strong className="text-zinc-200">Cloudflare, Inc.</strong> —{" "}
            {tx(
              "Cloudflare R2 object storage for uploaded scan assets. Website: cloudflare.com — legal address published on the provider's site.",
              "Stockage objet R2 pour les clichés téléversés. Site : cloudflare.com — mentions légales sur le site de l’éditeur.",
            )}
          </li>
        </ul>
        <p className="mt-3 text-sm text-zinc-500">
          {tx(
            'For exhaustive sub-processor and transfer information, rely on ScoreMax SAS’s Privacy Policy and, where mandatory, supplemental Data Processing Agreements.',
            'Pour une liste exhaustive des sous-traitants et des garanties juridiques de transferts, voir également la Politique de confidentialité de ScoreMax SAS et tout contrat de sous-traitance applicable.',
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("3. Intellectual property", "3. Propriété intellectuelle")}
        </h2>
        <p>
          {tx(
            "Unless expressly stated otherwise, all components of the Site (structure, textual content, UX copy, screenshots, visuals, logos, underlying software compilations excluding user-generated photos) constitute works protected under French intellectual property legislation and relevant international treaties. Any reproduction, redistribution, scraping, adaptation, extraction of models outside the lawful scope of licence granted in the Terms, or commercial reuse without ScoreMax SAS’s written consent is forbidden subject to narrower rights reserved to users regarding their own content.",
            "Sauf mention contraire, l’ensemble des éléments du Site (structure, contenus rédactionnels, textes d’interface, maquettes, visuels, marques ou signes distinctifs, compilations logicielles hors clichés téléversés par les utilisateurs) constituent des œuvres protégées au titre du droit d’auteur et du droit des bases de données. Toute reproduction, représentation, extraction de modèle au-delà de ce que permettent les CGU, ou exploitation commerciale sans autorisation écrite de ScoreMax SAS est interdite, sous réserve des droits réservés aux utilisateurs sur leurs propres créations.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx(
            "4. Personal data, cookies & liability",
            "4. Données personnelles, cookies et limitation de responsabilité",
          )}
        </h2>
        <p>
          {tx(
            "Processing of personal data is described in detail in",
            "Le traitement des données personnelles est décrit de manière exhaustive dans ",
          )}
          <Link href="/privacy" className="text-[#d6e4ff] underline hover:text-white">
            {tx("our Privacy Policy", "notre Politique de confidentialité")}
          </Link>
          {tx(".", ".")}
        </p>
        <p className="mt-3">
          {tx(
            "Session cookies / local storage equivalents may be deposited by authentication providers (Supabase) to secure your sessions; no advertising cookie wall is monetised directly by ScoreMax pursuant to CNIL Guidelines when such guidance applies.",
            "Des cookies nécessaires de session ou équivalents peuvent être déposés par le fournisseur d’authentification (Supabase) pour sécuriser la connexion ; ScoreMax SAS ne monétise aucun mécanisme équivalent aux traceurs publicitaires « mur à cookies », dans les limites où la réglementation applicable s’applique au Service tel que déployé.",
          )}
        </p>
        <p className="mt-3">
          {tx(
            'ScoreMax SAS strives for accurate lawful information yet cannot guarantee that all third-party disclosures (host addresses, subsidiaries) remain static; please refer to contractual documents for binding processor lists. Under French law ScoreMax SAS’s liability is limited as stipulated in its Terms.',
            'ScoreMax SAS s’efforce d’actualiser ces mentions ; certaines données techniques fournisseurs peuvent cependant être amenées à évoluer. La responsabilité de ScoreMax SAS est encadrée par les Conditions générales d’utilisation et la loi applicable.',
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("5. Out-of-court consumer dispute mediation (France/EU)", "5. Règlement extrajudiciaire des litiges (France / UE)")}
        </h2>
        <p>
          {tx(
            "Under Articles L611-1 and following of the French Consumer Code, any consumer meeting the statutory conditions may, after unsuccessfully contacting ScoreMax SAS in writing, refer the matter free of charge to a consumer mediator. The mediator’s contact details will be displayed on this site once designation is final.",
            "Conformément aux articles L611-1 et suivants du Code de la consommation, après désignation d’un médiateur de la consommation et publication de ses coordonnées, tout consommateur ayant résidé en France lors de la conclusion du contrat pourra saisir ce médiateur pour tout litige relatif à une commande qui n’aurait pas trouvé résolution après réclamation préalable écrite auprès de ScoreMax SAS. Les informations de désignation seront communiquées sur le Site lorsque finalisées.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("6. Applicable law and jurisdiction", "6. Loi applicable et juridictions compétentes")}
        </h2>
        <p>
          {tx(
            "These legal notices reflect French substantive law. For consumers resident in the EU / EEA, mandatory consumer protections prevail where applicable; nothing here is intended to waive them. Judicial competence for matters not strictly reserved for consumer courts follows the ScoreMax SAS Terms of Service.",
            "Les présentes mentions légales relèvent du droit matériel français. Pour tout consommateur dont la résidence habituelle se situe dans l’Union européenne ou l’EEE, aucune disposition ci-incluse ne vise à écarter une protection impérative applicable. Hors cas relevant de compétences spéciales en matière de consommation, les règles de compétence des tribunaux figurent aux Conditions générales d’utilisation.",
          )}
        </p>
      </section>
    </LegalPageShell>
  );
}

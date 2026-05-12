import { Link } from "wouter";
import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { i18n, useAppLanguage } from "@/lib/i18n";

/**
 * V1 — alignée RGPD / LIL ; revue juridique recommandée (art. 9 données sensibles,
 * transferts hors UE, DPA sous-traitants).
 */
const PRIVACY_EFFECTIVE_DATE = { en: "5 May 2026", fr: "5 mai 2026" };

export default function Confidentialite() {
  const language = useAppLanguage();
  const tx = (en: string, fr: string) => i18n(language, { en, fr });

  return (
    <LegalPageShell
      current="privacy"
      title={i18n(language, {
        en: "Privacy policy",
        fr: "Politique de confidentialité",
      })}
    >
      <p className="-mt-4 text-sm font-medium text-zinc-500">
        {tx("Effective date:", "Date d’effet :")}{" "}
        {i18n(language, PRIVACY_EFFECTIVE_DATE)}
      </p>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("1. Who we are", "1. Qui sommes-nous ?")}
        </h2>
        <p>
          {tx(
            "The Service is operated by ScoreMax SAS, a French company with its registered office at 123 Rue de la Tech, 75001 Paris, France (« ScoreMax », « we », « us »). For the purposes of the EU General Data Protection Regulation (GDPR), ScoreMax SAS is the data controller of personal data processed in connection with the Service, except where a processor processes data strictly on our instructions.",
            "Le Service est exploité par ScoreMax SAS, société immatriculée en France, dont le siège social est situé 123 Rue de la Tech, 75001 Paris (« ScoreMax », « nous »). Au sens du Règlement général sur la protection des données (RGPD), ScoreMax SAS est responsable de traitement des données à caractère personnel traitées dans le cadre du Service, sauf lorsqu’un sous-traitant agit exclusivement sur instruction documentée.",
          )}
        </p>
        <p className="mt-3">
          {tx(
            "Privacy contact: contact@scoremax.fr (please include your account email and, if possible, your internal user reference).",
            "Contact confidentialité : contact@scoremax.fr (veuillez indiquer l’adresse email de votre compte et, si possible, une référence interne).",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("2. Scope and relationship with the Terms", "2. Champ d’application et lien avec les CGU")}
        </h2>
        <p>
          {tx(
            "This Policy explains how we collect, use, store, and share personal data when you browse, register, capture photos, purchase paid features, or otherwise interact with the Service. It should be read together with our",
            "La présente politique décrit comment nous collectons, utilisons, conservons et pouvons transmettre des données personnelles lorsque vous consultez le Site, créez un compte, capturez des photos, souscrivez à des offres payantes ou utilisez toute autre fonctionnalité. Elle complète nos ",
          )}
          <Link href="/terms" className="text-[#d6e4ff] underline hover:text-white">
            {tx("Terms of Service", "Conditions générales d’utilisation")}
          </Link>
          {tx(
            ", which govern your contractual relationship with ScoreMax.",
            ", qui encadrent la relation contractuelle avec ScoreMax.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("3. Categories of data we process", "3. Catégories de données traitées")}
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            {tx(
              "Account & profile: email address, display name if provided, language preferences, subscription role flags, timestamps of account activity, authentication identifiers managed by our identity provider.",
              "Compte et profil : adresse email, nom affiché le cas échéant, préférences de langue, indicateurs d’abonnement ou de rôle, horodatages d’activité, identifiants d’authentification gérés par notre prestataire d’identité.",
            )}
          </li>
          <li>
            {tx(
              "Facial imagery & related capture data: photographs of your face (JPEG/PNG) that you upload or capture through guided flows, technical overlay images (« guide traces »), machine-readable landmarks or measurements derived locally in your browser prior to submission, checksums/file sizes assisting integrity checks.",
              "Imagerie faciale et données de capture : photographies du visage (JPEG/PNG) que vous téléversez dans des parcours guidés, images techniques de superposition (« repères »), mesures géométriques issues du traitement local dans votre navigateur avant envoi, empreintes techniques (tailles, checksums) pour vérifications d’intégrité.",
            )}
          </li>
          <li>
            {tx(
              "Analysis outputs & history: textual or numeric summaries generated remotely (scores, rationales stripped of identifiers where applicable), job identifiers tying a run to submitted assets, persisted error codes if a technical failure occurs.",
              "Résultats d’analyse et historique : synthèses textuelles ou numériques générées à distance (scores, rationnels dépersonnalisés lorsque pertinent), identifiants de traitement reliant une analyse aux médias soumis, codes d’erreur techniques en cas d’échec.",
            )}
          </li>
          <li>
            {tx(
              "Payment information: subscription status, product identifiers, billing history metadata. Card or wallet data is collected directly by our payment partner; ScoreMax typically receives only tokens or confirmation payloads.",
              "Paiements : état de souscription, identifiants d’offre, métadonnées de facturation. Les données bancaires sont saisies auprès de notre prestataire de paiement ; ScoreMax ne reçoit généralement que des statuts agrégés ou des jetons de confirmation.",
            )}
          </li>
          <li>
            {tx(
              "Support & reliability telemetry (limited): voluntarily submitted screenshots or messages when you email us, aggregated technical reports from authenticated clients containing error source labels, abbreviated stack hints, routing path (URL), and browser agent string captured when you authenticate while reporting.",
              "Assistance et signalements techniques (limités) : captures ou messages envoyés volontairement, rapports automatiques hors contenu médical comportant étiquettes d’erreur, indication de provenance dans l’application, chemin URL et user-agent lorsque vous êtes connecté lors du signalement.",
            )}
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx(
            "4. Purposes, legal bases, and special-category considerations",
            "4. Finalités, bases légales et données particulières",
          )}
        </h2>
        <p>
          {tx(
            "We rely on:",
            "Nous nous appuyons notamment sur :",
          )}
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            {tx(
              "Performance of the contract (GDPR Art. 6(1)(b)) to create your account, store submitted imagery, run automated analyses, display results, and invoice paid plans.",
              "L’exécution du contrat (art. 6(1)(b) RGPD) pour créer le compte, conserver les clichés, lancer les analyses automatisées, afficher les résultats et gérer la facturation.",
            )}
          </li>
          <li>
            {tx(
              "Legitimate interests (Art. 6(1)(f)) to maintain security, troubleshoot incidents, quantify usage, resist abuse subject to balancing tests respecting your fundamental rights.",
              "L’intérêt légitime (art. 6(1)(f)) pour sécuriser le Service, diagnostiquer des incidents mesurés préalablement contre vos droits et libertés fondamentaux, et prévenir les abus.",
            )}
          </li>
          <li>
            {tx(
              "Legal obligations (Art. 6(1)(c)), e.g. accounting retention or lawful orders from authorities.",
              "Une obligation légale (art. 6(1)(c)), notamment obligations comptables ou réquisitions d’autorités compétentes.",
            )}
          </li>
          <li>
            {tx(
              "Consent (Art. 6(1)(a) — and Art. 9(2)(a) where required) for optional newsletters, experimentation features not strictly necessary for the subscribed service, or any processing voluntarily activated beyond core delivery and explicit in-app.",
              "Le consentement (art. 6(1)(a) — et art. 9(2)(a) le cas échéant) pour des fonctionnalités facultatives, expérimentations non indispensables à la prestation contractuelle, ou tout traitement activé volontairement au-delà du cœur du Service et présenté explicitement dans l’interface.",
            )}
          </li>
        </ul>
        <p className="mt-3">
          {tx(
            "Images of the human face may qualify as biometric or health-adjacent data in certain jurisdictions. ScoreMax does not provide medical diagnostics; nevertheless, where law classifies such imagery as special-category data, we limit processing to what is necessary to deliver the aesthetic self-assessment service you request and we document appropriate safeguards (access controls, minimisation, retention caps).",
            "Des images du visage peuvent être qualifiées de données biométriques ou, dans certains cas, rapprochées de données de santé au sens du RGPD. ScoreMax ne fournit pas de diagnostic médical ; lorsque le droit applicable impose un régime renforcé, nous limitons le traitement au strict nécessaire à la prestation d’auto-évaluation esthétique demandée et mettons en œuvre des garanties appropriées (contrôle d’accès, minimisation, durées de conservation encadrées).",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("5. Recipients and subprocessors", "5. Destinataires et sous-traitants")}
        </h2>
        <p>
          {tx(
            "We share data only with trusted service providers bound by written agreements requiring GDPR-standard duties. As of the effective date, the principal categories include:",
            "Nous ne communiquons des données qu’à des prestataires liés par des engagements contractuels conformes au RGPD. À la date d’effet, les principales catégories sont :",
          )}
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong className="text-zinc-200">Supabase, Inc.</strong> —{" "}
            {tx("hosted PostgreSQL, Row Level Security policies, REST APIs, authentication tokens.", "base PostgreSQL hébergée, politiques Row Level Security, API PostgREST, jetons d’authentification.")}
          </li>
          <li>
            <strong className="text-zinc-200">Cloudflare, Inc.</strong> —{" "}
            {tx("Cloudflare R2 storage holding binary scan assets referenced from the database.", "stockage binaire Cloudflare R2 pour les clichés dont la base conserve les métadonnées.")}
          </li>
          <li>
            <strong className="text-zinc-200">Railway Corp.</strong> —{" "}
            {tx("Compute hosting executing backend logic that orchestrates jobs and signed uploads.", "hébergement applicatif pour les orchestrations backend et URL signées d’upload.")}
          </li>
          <li>
            <strong className="text-zinc-200">Dodo Payments</strong> —{" "}
            {tx("Payment checkout, recurring billing synchronization, webhook validation (company details per Dodo’s public disclosures).", "tunnel de paiement, synchronisation d’abonnement, webhooks (coordonnées selon informations publiques Dodo Payments).")}
          </li>
          <li>
            <strong className="text-zinc-200">{tx("Remote analysis inference API", "API d’analyse à distance")}</strong>{" "}
            {tx("(operated separately from the open web app) consuming encoded imagery and returning structured worker outputs necessary to display your results.", "(distincte de l’application grand public) : reçoit les médias encodés et renvoie des résultats structurés exploités pour afficher votre analyse.")}
          </li>
        </ul>
        <p className="mt-3 text-sm text-zinc-500">
          {tx(
            "The list may evolve; material changes will be reflected in updated versions of this Policy or direct notice when legally required.",
            "La liste peut évoluer ; toute modification substantielle fera l’objet d’une mise à jour de la présente politique ou d’une information directe lorsque la loi l’exige.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("6. International transfers", "6. Transferts hors Union européenne")}
        </h2>
        <p>
          {tx(
            "Some subprocessors are established outside the European Economic Area (notably in the United States). Where required, we implement Standard Contractual Clauses approved by the European Commission, supplementary measures described in their documentation, and continuous assessment of legislation affecting government access requests.",
            "Certains sous-traitants sont situés hors de l’Espace économique européen (notamment aux États-Unis). Le cas échéant, nous mettons en œuvre les clauses contractuelles types de la Commission européenne, les mesures complémentaires recommandées par les guides EDPB, et une veille sur les cadres légaux applicables aux accès publics.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("7. Retention", "7. Durées de conservation")}
        </h2>
        <p>
          {tx(
            "We keep personal data only as long as necessary for the purposes above. By default, account data persists while your account is active. Uploaded imagery linked to completed analyses may be retained to let you review historical runs unless you request deletion (subject to lawful retention freezes). Deleted accounts trigger erasure pipelines described in deletion flows, including removal of pointers in our database and best-effort object storage deletion.",
            "Nous conservons les données aussi longtemps que nécessaire aux finalités exposées : les données de compte demeurent pendant la vie active du profil ; les clichés peuvent être conservés tant que nécessaires à l’affichage d’un historique d’analyses, sauf suppression sollicitée (sous réserve d’obligation légale de conservation ou de gel probatoire). La suppression du compte déclenche des traitements devant rendre inaccessible les métadonnées et supprimer, dans la mesure du possible, les objets sous-jacents sur le stockage.",
          )}
        </p>
        <p className="mt-3">
          {tx(
            "Aggregated, irreversibly anonymised statistics may be retained without time limitation.",
            "Des statistiques agrégées et anonymisées de manière irréversible peuvent être conservées sans limitation de durée.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("8. Your rights", "8. Vos droits")}
        </h2>
        <p>
          {tx(
            "Depending on jurisdiction, you may request access, rectification, erasure, restriction of processing, data portability (where technically feasible), and objection to processing grounded on legitimate interest. Where processing is consent-based you may withdraw consent without affecting earlier lawfulness. You may lodge a complaint with your local supervisory authority (in France: CNIL, www.cnil.fr). To exercise rights, email contact@scoremax.fr after reasonably proving your identity.",
            "Selon votre situation, vous pouvez demander l’accès, la rectification, l’effacement, la limitation du traitement, la portabilité lorsqu’elle est techniquement possible, ou vous opposer à un traitement fondé sur l’intérêt légitime. Lorsque le traitement repose sur le consentement, vous pouvez le retirer sans affecter la licéité antérieure. Vous pouvez introduire une réclamation auprès de l’autorité de contrôle (en France : CNIL, www.cnil.fr). Pour exercer vos droits, écrivez à contact@scoremax.fr en justifiant raisonnablement de votre identité.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("9. Security measures", "9. Sécurité")}
        </h2>
        <p>
          {tx(
            "We implement TLS encryption in transit between clients and backends, segmented access credentials, hashed secrets for server integrations, periodic dependency updates, and database policies restricting row-level reads to authenticated owners. Administrators are subject to least-privilege access review. Please choose a strong password; you remain responsible for device compromise impacting your captures.",
            "Des mesures comme le chiffrement TLS en transit, la segmentation des accès, les habilitations par politiques de base (« Row Level Security »), la rotation régulière des dépendances et des secrets de service, ainsi que les accès administrateur à privilège minimal, sont déployées. Vous êtes invité à choisir un mot de passe robuste ; la sécurité de votre terminal reste votre responsabilité.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("10. Minors", "10. Mineurs")}
        </h2>
        <p>
          {tx(
            "The Service is strictly offered to adults (see Terms). If you suspect a minor’s data was erroneously uploaded, notify us promptly for corrective action.",
            "Le Service s’adresse aux personnes majeures (voir CGU). Si vous pensez qu’un mineur a transmis des données par erreur, contactez-nous sans délai pour que nous puissions remédier à la situation.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx(
            "11. Automated decision-making",
            "11. Décisions automatisées et profilage",
          )}
        </h2>
        <p>
          {tx(
            "Results are generated algorithmically and may influence visualisation or recommendations within the app; they do not produce legal or similarly significant effects under Article 22 GDPR without human review beyond the described automation.If you require human explanation, contact us and we will respond within reasonable delays consistent with technical documentation available.",
            "Les résultats sont produits par des algorithmes et peuvent orienter l’affichage ou des recommandations au sein de l’application ; ils ne produisent pas d’effet juridique ou équivalent significatif au sens de l’article 22 RGPD sans revue humaine au-delà de ce qui est décrit. Pour toute demande d’information sur la logique sous-jacente, écrivez-nous ; nous répondrons dans un délai raisonnable compte tenu de la documentation technique disponible.",
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {tx("12. Changes to this Policy", "12. Évolution de la politique")}
        </h2>
        <p>
          {tx(
            "We may update this Policy to reflect product, legal, or security changes. A new effective date will appear at the top. Material changes affecting consent may require renewed acceptance where applicable law demands.",
            "Nous pouvons modifier la présente politique pour refléter l’évolution du Service, des textes ou des exigences de sécurité. Une nouvelle date d’effet sera indiquée en tête de document. Lorsque la loi impose un nouveau consentement pour certains traitements, nous mettrons en œuvre les formalités requises.",
          )}
        </p>
      </section>

      <p className="border-t border-white/10 pt-6 text-sm text-zinc-500">
        {tx(
          "This document is provided for informational purposes and does not replace legal advice.Adapt numbering of articles (L611-1 / L612-1 mediation) upon final mediator appointment under French Consumer Code obligations.",
          "Document d’information — ne substitue pas un conseil juridique personnalisé. Harmoniser sous contrôle juridique les références au Code de la consommation après désignation effective du médiateur.",
        )}
      </p>
    </LegalPageShell>
  );
}

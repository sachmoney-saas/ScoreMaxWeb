import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { i18n, useAppLanguage } from "@/lib/i18n";

export default function MentionsLegales() {
  const language = useAppLanguage();

  return (
    <LegalPageShell
      current="legal-notice"
      title={i18n(language, {
        en: "Legal notice",
        fr: "Mentions légales",
      })}
    >
      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {i18n(language, {
            en: "1. Publisher",
            fr: "1. Éditeur du site",
          })}
        </h2>
        <p>{i18n(language, { en: "Company name: ScoreMax SAS", fr: "Nom de l'entreprise : ScoreMax SAS" })}</p>
        <p>
          {i18n(language, {
            en: "Registered office: 123 Rue de la Tech, 75001 Paris, France",
            fr: "Siège social : 123 Rue de la Tech, 75001 Paris, France",
          })}
        </p>
        <p>
          {i18n(language, {
            en: "Email: contact@scoremax.fr",
            fr: "Email : contact@scoremax.fr",
          })}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {i18n(language, {
            en: "2. Hosting",
            fr: "2. Hébergeur",
          })}
        </h2>
        <p>
          {i18n(language, {
            en: "The site is hosted by a professional cloud infrastructure provider.",
            fr: "Le site est hébergé par un prestataire d'infrastructure cloud professionnel.",
          })}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {i18n(language, {
            en: "3. Intellectual property",
            fr: "3. Propriété intellectuelle",
          })}
        </h2>
        <p>
          {i18n(language, {
            en: "This site is governed by French and international law on copyright and intellectual property.",
            fr: "L'ensemble de ce site relève de la législation française et internationale sur le droit d'auteur et la propriété intellectuelle.",
          })}
        </p>
      </section>
    </LegalPageShell>
  );
}

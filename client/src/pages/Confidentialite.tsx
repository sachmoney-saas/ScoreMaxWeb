import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { i18n, useAppLanguage } from "@/lib/i18n";

export default function Confidentialite() {
  const language = useAppLanguage();

  return (
    <LegalPageShell
      current="privacy"
      title={i18n(language, {
        en: "Privacy policy",
        fr: "Politique de confidentialité",
      })}
    >
      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {i18n(language, {
            en: "1. Data we collect",
            fr: "1. Collecte des données",
          })}
        </h2>
        <p>
          {i18n(language, {
            en: "We collect information you provide when you register (e.g. email, name).",
            fr: "Nous collectons les informations que vous nous fournissez lors de votre inscription (email, nom).",
          })}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">
          {i18n(language, {
            en: "2. How we use data",
            fr: "2. Utilisation des données",
          })}
        </h2>
        <p>
          {i18n(language, {
            en: "Your data is used solely to operate your account and our services.",
            fr: "Vos données sont utilisées exclusivement pour le bon fonctionnement de votre compte et de nos services.",
          })}
        </p>
      </section>
    </LegalPageShell>
  );
}

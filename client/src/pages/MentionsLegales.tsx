import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

export default function MentionsLegales() {
  return (
    <div className="min-h-screen bg-background py-20 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link href="/" className="text-primary hover:underline">
          ← Retour à l'accueil
        </Link>
        <h1 className="text-4xl font-display font-bold">Mentions Légales</h1>

        <Card>
          <CardContent className="pt-6 space-y-4 text-muted-foreground">
            <section>
              <h2 className="text-xl font-bold text-foreground mb-2">
                1. Éditeur du site
              </h2>
              <p>Nom de l'entreprise : ScoreMax SAS</p>
              <p>Siège social : 123 Rue de la Tech, 75001 Paris, France</p>
              <p>Email : contact@scoremax.fr</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-2">
                2. Hébergeur
              </h2>
              <p>
                Le site est hébergé par un prestataire d'infrastructure cloud
                professionnel.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-2">
                3. Propriété intellectuelle
              </h2>
              <p>
                L'ensemble de ce site relève de la législation française et
                internationale sur le droit d'auteur et la propriété
                intellectuelle.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

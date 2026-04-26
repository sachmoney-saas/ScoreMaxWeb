# ScoreMax — Architecture web/iOS (source de vérité)

## Rôle des applications

- **Application web = centre du produit**
  - pilote l’onboarding et l’expérience principale;
  - déclenche les appels d’analyse vers l’API ScoreMax (via backend);
  - lit la progression des photos dans Supabase pour débloquer la fin d’onboarding.

- **Application iOS = capture photo spécialisée**
  - prend les photos demandées;
  - upload les médias dans R2;
  - écrit les métadonnées de scan dans la base Supabase partagée;
  - redirige ensuite l’utilisateur vers l’application web.

## Base de données partagée

La base Supabase est partagée entre web et iOS:
- l’iOS y publie l’état des captures;
- le web y lit l’état en polling pour savoir quelles photos manquent ou si le scan est complet.

Document détaillé des tables et du contrat iOS:
- `IOS_AGENT_TABLES_GUIDE.md`

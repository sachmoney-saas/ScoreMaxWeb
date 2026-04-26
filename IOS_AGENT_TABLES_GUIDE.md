# ScoreMax — Guide tables Supabase pour l’agent IA iOS

Ce document décrit **le modèle actuel (v2)** et le **contrat de rôles entre les apps**.  
Il est destiné à l’agent IA iOS pour qu’il comprenne précisément qui fait quoi entre web/iOS, **quoi écrire en base partagée**, et comment l’état onboarding est validé côté web.

---

## 1) Architecture produit et rôles (web centrique)

Le **centre du produit est l’application web**.

Répartition des rôles:
- **Application web**
  - pilote l’onboarding global;
  - demande explicitement à l’utilisateur d’aller sur l’app iOS pour capturer les photos;
  - suit la progression en temps réel via la DB partagée (polling `get_onboarding_scan_status()`);
  - déclenche les appels d’analyse vers l’API ScoreMax (via backend web).
- **Application iOS**
  - a un rôle spécialisé: **prendre les photos**;
  - upload les médias dans R2 et écrit les métadonnées dans Supabase;
  - redirige l’utilisateur vers l’application web une fois la capture terminée.
- **Base Supabase partagée**
  - source de vérité commune web + iOS;
  - permet de savoir si chaque photo est prise/valide ou manquante.

Le domaine scan/onboarding est structuré autour de 6 tables métier :

1. `public.scan_asset_types` → taxonomie des types de photos (dont les 8 obligatoires onboarding)
2. `public.scan_sessions` → session de capture (état global d’avancement)
3. `public.scan_assets` → métadonnées des photos uploadées (R2 key, mime, statut, etc.)
4. `public.analysis_jobs` → exécution d’analyse versionnée
5. `public.analysis_job_assets` → snapshot des assets utilisés par un run d’analyse
6. `public.analysis_results` → résultat JSON produit par un worker

Points clés :
- **Pas de table legacy `public.scans`** (supprimée)
- **Pas de colonnes legacy** dans `scan_assets` (`scan_id`, `asset_type`, `bucket`, `object_path` absentes)
- L’état de complétude onboarding est calculé via RPC: `public.get_onboarding_scan_status()`

---

## 2) Tables et rôles

## 2.1 `public.scan_asset_types`

Rôle: référentiel des types de photos.

Colonnes principales:
- `code` (PK, text)
- `label_fr` (text)
- `is_required_onboarding` (boolean)
- `sort_order` (integer)
- `is_active` (boolean)
- `created_at`, `updated_at`

Pour l’onboarding, les 8 types requis actifs sont:
- `FACE_FRONT`
- `PROFILE_LEFT`
- `PROFILE_RIGHT`
- `LOOK_UP`
- `LOOK_DOWN`
- `SMILE`
- `HAIR_BACK`
- `EYE_CLOSEUP`

Usage iOS:
- lire cette table (ou se baser sur une config embarquée synchronisée) pour afficher l’ordre attendu.
- insérer dans `scan_assets.asset_type_code` uniquement des `code` existants/actifs.

---

## 2.2 `public.scan_sessions`

Rôle: session de collecte utilisateur (onboarding ou rescan), avec progression agrégée.

Colonnes principales:
- `id` (PK, uuid)
- `user_id` (FK `auth.users.id`)
- `source` (`onboarding` | `manual_rescan` | `automated`)
- `status` (`collecting` | `ready` | `processing` | `completed` | `failed` | `abandoned`)
- `required_asset_count` (int)
- `completed_asset_count` (int)
- `started_at`, `ready_at`, `completed_at`, `created_at`, `updated_at`

Contraintes importantes:
- `completed_asset_count <= required_asset_count`
- index unique partiel pour éviter plusieurs sessions onboarding actives simultanées par user

Usage iOS:
- en pratique, ne crée pas la session “à la main” si tu utilises le polling RPC;
- `ensure_onboarding_scan_session()` (appelée par `get_onboarding_scan_status`) garantit une session active.

---

## 2.3 `public.scan_assets`

Rôle: métadonnées de chaque photo uploadée (le média reste dans R2).

Colonnes principales:
- `id` (PK, uuid)
- `session_id` (FK `scan_sessions.id`, non null)
- `user_id` (FK `auth.users.id`, non null)
- `asset_type_code` (FK `scan_asset_types.code`, non null)
- `r2_bucket` (text, nullable)
- `r2_key` (text, non null)
- `mime_type` (`image/jpeg` | `image/png`, non null)
- `byte_size` (bigint, nullable)
- `checksum_sha256` (text, nullable)
- `upload_status` (`pending` | `uploaded` | `validated` | `failed`, non null)
- `captured_at` (timestamptz, nullable)
- `created_at`, `updated_at`

Contrainte d’unicité:
- `UNIQUE (session_id, asset_type_code, r2_key)`

Règle de comptage onboarding:
- un asset compte comme “complété” uniquement si:
  - `upload_status IN ('uploaded','validated')`
  - `r2_key` non vide
  - `asset_type_code` fait partie des types requis actifs
- le calcul est fait en **COUNT(DISTINCT asset_type_code)**.

Implication iOS:
- pour débloquer l’onboarding, il faut au moins une entrée valide par type requis.
- éviter les `upload_status='pending'` persistants après upload R2 réussi.

---

## 2.4 `public.analysis_jobs`

Rôle: registre des runs d’analyse, versionnés par session.

Colonnes principales:
- `id` (PK)
- `user_id` (FK)
- `session_id` (FK)
- `trigger_source` (`onboarding_auto` | `user_rerun` | `admin`)
- `status` (`queued` | `running` | `completed` | `failed`)
- `request_payload` (jsonb)
- `version` (int > 0)
- `parent_analysis_job_id` (self-FK nullable)
- `upstream_job_id`, `error_code`, `error_message`
- `started_at`, `completed_at`, `failed_at`, `created_at`, `updated_at`

Contrainte importante:
- index unique `(session_id, version)`

But: supporter les **ré-analyses** sans écraser l’historique.

---

## 2.5 `public.analysis_job_assets`

Rôle: snapshot des assets exacts utilisés par un job d’analyse.

Colonnes principales:
- `analysis_job_id` (FK)
- `asset_type_code` (FK)
- `scan_asset_id` (FK)
- `user_id` (FK)
- `created_at`

Clé primaire composite:
- `(analysis_job_id, asset_type_code)`

But: garantir la traçabilité (quels fichiers ont servi à quel run).

---

## 2.6 `public.analysis_results`

Rôle: stockage des sorties worker.

Colonnes principales:
- `id` (PK)
- `analysis_job_id` (FK)
- `user_id` (FK)
- `worker` (text)
- `prompt_version` (text)
- `provider` (text, nullable)
- `result` (jsonb)
- `created_at`

Contrainte d’unicité:
- unique `(analysis_job_id, worker)`

---

## 3) Fonctions RPC / triggers utilisés pour l’onboarding

Fonctions:
- `public.ensure_onboarding_scan_session() -> uuid`
- `public.scoremax_refresh_scan_session_progress(target_session uuid) -> void`
- `public.get_onboarding_scan_status() -> table(...)`

Trigger:
- `scoremax_on_scan_asset_change` sur `public.scan_assets`
- appelle `scoremax_refresh_scan_session_progress_trigger()` après insert/update/delete.

### 3.1 Contrat de `get_onboarding_scan_status()`

Retour:
- `session_id: uuid`
- `required_asset_count: int`
- `completed_asset_count: int`
- `is_ready: bool`
- `missing_asset_types: text[]` (labels FR)

Comportement:
1. exige un utilisateur authentifié (`auth.uid()`)
2. crée/récupère une session onboarding active
3. recalcule la progression
4. retourne l’état de la session

⚠️ En contexte non authentifié, la fonction lève: `auth.uid() is required`.

---

## 4) Sécurité / RLS (important côté iOS)

RLS est activée sur les tables du domaine scan/analyse.  
Les policies `scoremax_*` imposent principalement:
- lecture/écriture sur ses propres lignes (`auth.uid() = user_id`)
- contrôle de cohérence inter-table (ex: asset inséré seulement si session du user existe)
- accès admin séparé via `scoremax_is_admin(auth.uid())`

Conséquence iOS:
- toutes les opérations doivent être faites avec un JWT utilisateur valide Supabase;
- ne jamais supposer qu’un insert/update passera sans respecter les liens de propriété.

---

## 5) Séquence réelle cross-app (web ↔ iOS)

1. L’utilisateur suit l’onboarding sur le **web**.
2. Le web affiche l’instruction: aller sur l’app iOS pour capturer les photos demandées.
3. Sur iOS (capture only):
   - authentifier l’utilisateur;
   - prendre les photos;
   - uploader vers R2;
   - écrire/mettre à jour `scan_assets` avec `session_id`, `user_id`, `asset_type_code`, `r2_key`, `mime_type`, `upload_status='uploaded'` (+ métadonnées optionnelles).
4. iOS redirige l’utilisateur vers le **web**.
5. Le web reprend la main et poll `get_onboarding_scan_status()` toutes les ~2.5s jusqu’à `is_ready = true`.
6. Une fois prêt, le web débloque la fin d’onboarding puis orchestre les analyses via son backend/API ScoreMax.

---

## 6) Invariants à respecter côté agent iOS

- Ne pas utiliser de schéma legacy (`scans`, `scan_id`, `asset_type`, `bucket`, `object_path`).
- L’app iOS ne pilote pas l’onboarding web: elle capture et publie uniquement les métadonnées de scan.
- `mime_type` doit être `image/jpeg` ou `image/png`.
- `r2_key` non vide si `upload_status` est `uploaded`/`validated`.
- Pour compter vers la complétude: un type requis actif doit avoir au moins un asset valide.
- Après capture, renvoyer l’utilisateur vers le web pour la suite du flux produit.
- Le backend web orchestre les appels d’analyse et peut garder plusieurs runs d’analyse (historique immuable) via `analysis_jobs` versionnés.

---

## 7) Référence rapide (mapping onboarding)

- Visage de face → `FACE_FRONT`
- Profil gauche → `PROFILE_LEFT`
- Profil droit → `PROFILE_RIGHT`
- Regarder en haut → `LOOK_UP`
- Regarder en bas → `LOOK_DOWN`
- Sourire → `SMILE`
- Cheveux en arrière → `HAIR_BACK`
- Gros plan œil → `EYE_CLOSEUP`

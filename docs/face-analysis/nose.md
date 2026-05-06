# nose

## Worker key

- `nose`

## Expected output fields v1

Scores may be emitted as a number, a numeric string, or a **single-element array**; the client normalises via `getScore`. Enums are plain strings (or nested `{ value, argument }` if the pipeline adds an argument).

```json
{
  "frontal_symmetry_and_width.nose_symmetry.score": "integer",
  "frontal_symmetry_and_width.nose_symmetry.argument": "concise summary text",
  "frontal_symmetry_and_width.overall_alar_width.score": "integer",
  "frontal_symmetry_and_width.overall_alar_width.argument": "concise summary text",
  "frontal_symmetry_and_width.bridge_width.score": "integer",
  "frontal_symmetry_and_width.bridge_width.argument": "concise summary text",
  "profile_dorsum_and_angles.bridge_shape": "value",
  "profile_dorsum_and_angles.supratip_break": "value",
  "profile_dorsum_and_angles.nasofrontal_angle.score": "integer",
  "profile_dorsum_and_angles.nasofrontal_angle.argument": "concise summary text",
  "profile_dorsum_and_angles.nasolabial_angle_rotation.score": "integer",
  "profile_dorsum_and_angles.nasolabial_angle_rotation.argument": "concise summary text",
  "tip_morphology.tip_definition.score": "integer",
  "tip_morphology.tip_definition.argument": "concise summary text",
  "tip_morphology.tip_projection.score": "integer",
  "tip_morphology.tip_projection.argument": "concise summary text",
  "base_nostrils_and_surface.nostril_shape": "value",
  "base_nostrils_and_surface.columella_alignment.score": "integer",
  "base_nostrils_and_surface.columella_alignment.argument": "concise summary text",
  "base_nostrils_and_surface.nose_length.score": "integer",
  "base_nostrils_and_surface.nose_length.argument": "concise summary text",
  "base_nostrils_and_surface.nasal_skin_surface": "value",
  "global_score.overall_nose_score.score": "integer",
  "global_score.overall_nose_score.argument": "concise summary text"
}
```

## Structures imbriquées

L’API peut renvoyer des groupes imbriqués (`tip_morphology`, `base_nostrils_and_surface`, `global_score`, etc.) ; les chemins pointés plats ci-dessus restent l’équivalent attendu côté agrégats.

## Rétrocompatibilité

Anciens segments retirés du contrat courant : `tip_morphology_and_projection.*`, `base_and_nostrils.*`, `overall_nose*` à la racine (remplacé par `global_score.overall_nose_score`). `supratip_break` n’est plus un score numérique dans le contrat courant.

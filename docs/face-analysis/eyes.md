# eyes

## Worker key

- `eyes`

## Expected output (nested v1)

Les agrégats peuvent être **imbriqués** ou **aplats** (chemins pointés équivalents, ex. `morphology_and_tilt.canthal_tilt`).

```json
{
  "morphology_and_tilt": {
    "canthal_tilt": "negative | neutral | positive",
    "eye_spacing": { "score": "integer 1-10", "argument": "string" },
    "orbital_depth": { "score": "integer 1-10", "argument": "string" },
    "eye_symmetry": { "score": "integer 1-10", "argument": "string" }
  },
  "eyelids_and_sclera": {
    "upper_eyelid_exposure": { "score": "integer 1-10", "argument": "string" },
    "lower_scleral_show": { "score": "integer 1-10", "argument": "string" },
    "epicanthic_fold": "present | absent"
  },
  "under_eye_health": {
    "under_eye_support": { "score": "integer 1-10", "argument": "string" },
    "under_eye_pigmentation": { "score": "integer 1-10", "argument": "string" }
  },
  "iris_sclera_and_lashes": {
    "sclera_clarity": { "score": "integer 1-10", "argument": "string" },
    "limbal_ring_visibility": "absent | faint | prominent",
    "eyelash_density": { "score": "integer 1-10", "argument": "string" },
    "iris_color": "light_blue | dark_blue | grey_blue | pure_grey | light_green | dark_green | hazel_green | hazel_brown | light_brown | medium_brown | dark_brown | amber | almost_black | central_heterochromia | sectoral_heterochromia"
  },
  "global_score": {
    "overall_eye_score": { "score": "integer 1-10", "argument": "string" }
  }
}
```

Les scores peuvent aussi être émis comme nombre, chaîne numérique ou **tableau à un élément** selon le pipeline ; le client normalise via `getNumber` / `getScore`.

## Rétrocompatibilité

Anciennes clés retirées du contrat courant : `details_and_color.*`, `under_eye_health.support_and_hollows`, `under_eye_health.pigmentation`, `overall_eye_score` à la racine (remplacé par `global_score.overall_eye_score`).

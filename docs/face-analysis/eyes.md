# eyes

## Worker key

- `eyes`

## Expected output fields v1

Scores may be emitted as a number, a numeric string, or a **single-element array** (e.g. `["7.2"]`) — the client normalises via `getNumber` / `getScore`.

```json
{
  "morphology_and_tilt.canthal_tilt": "value",
  "morphology_and_tilt.eye_spacing.score": "number | string | [string]",
  "morphology_and_tilt.eye_spacing.argument": "concise summary text",
  "morphology_and_tilt.orbital_depth.score": "number | string | [string]",
  "morphology_and_tilt.orbital_depth.argument": "concise summary text",
  "morphology_and_tilt.eye_symmetry.score": "number | string | [string]",
  "morphology_and_tilt.eye_symmetry.argument": "concise summary text",
  "eyelids_and_sclera.upper_eyelid_exposure.score": "number | string | [string]",
  "eyelids_and_sclera.upper_eyelid_exposure.argument": "concise summary text",
  "eyelids_and_sclera.lower_scleral_show.score": "number | string | [string]",
  "eyelids_and_sclera.lower_scleral_show.argument": "concise summary text",
  "eyelids_and_sclera.epicanthic_fold": "value",
  "under_eye_health.support_and_hollows.score": "number | string | [string]",
  "under_eye_health.support_and_hollows.argument": "concise summary text",
  "under_eye_health.pigmentation.score": "number | string | [string]",
  "under_eye_health.pigmentation.argument": "concise summary text",
  "details_and_color.sclera_clarity.score": "number | string | [string]",
  "details_and_color.sclera_clarity.argument": "concise summary text",
  "details_and_color.limbal_ring_visibility": "value",
  "details_and_color.eyelash_density.score": "number | string | [string]",
  "details_and_color.eyelash_density.argument": "concise summary text",
  "details_and_color.iris_color": "value",
  "overall_eye_score.score": "number | string | [string]",
  "overall_eye_score.argument": "concise summary text"
}
```

## Output possibles renvoyés

- `morphology_and_tilt.canthal_tilt`: `negative | neutral | positive` (pipeline may also emit aliases such as `downturned`, `downward`)
- `eyelids_and_sclera.epicanthic_fold`: `present | absent`
- `details_and_color.limbal_ring_visibility`: `absent | faint | prominent`
- `details_and_color.iris_color`: `light_blue | dark_blue | grey_blue | pure_grey | light_green | dark_green | hazel_green | hazel_brown | light_brown | medium_brown | dark_brown | amber | almost_black | central_heterochromia | sectoral_heterochromia`

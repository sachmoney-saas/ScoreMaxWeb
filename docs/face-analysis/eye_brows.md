# eye_brows

## Worker key

- `eye_brows`

## Expected output (nested v1)

The API may return **nested objects**; the app reads dotted paths (e.g. `placement_and_symmetry.eyebrow_elevation.score`). Équivalent aplati possible côté agrégateur.

```json
{
  "placement_and_symmetry": {
    "eyebrow_elevation": { "score": 1, "argument": "string" },
    "eyebrow_symmetry": { "score": 1, "argument": "string" }
  },
  "geometry_and_shape": {
    "eyebrow_tilt": "negative | neutral | positive",
    "eyebrow_shape": "straight | soft_arch | high_arch | rounded",
    "tail_length_and_direction": { "score": 1, "argument": "string" },
    "inner_start_shape": "squared | rounded | faded"
  },
  "density_grooming_and_glabella": {
    "eyebrow_thickness": { "score": 1, "argument": "string" },
    "eyebrow_density": { "score": 1, "argument": "string" },
    "glabellar_hair": { "score": 1, "argument": "string" },
    "grooming_quality": "natural_untouched | well_groomed | over_groomed | unkempt",
    "brow_color": "light_blonde | dark_blonde | red | light_brown | dark_brown | black | grey"
  },
  "global_score": {
    "overall_brow_score": { "score": 1, "argument": "string" }
  }
}
```

## Rétrocompatibilité (agrégats aplatis hérités)

Les clés historiques (`placement_and_spacing.*`, `geometry_and_tilt.*`, `thickness_and_density.*`, `overall_brow*`) ne sont plus documentées comme contrat courant ; l’UI attend la structure ci-dessus.

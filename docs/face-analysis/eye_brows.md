# eye_brows

## Worker key

- `eye_brows`

## Expected output fields v1

```json
{
  "placement_and_spacing.elevation_brow_to_eye.score": "number",
  "placement_and_spacing.elevation_brow_to_eye.argument": "concise summary text",
  "placement_and_spacing.inter_brow_distance.score": "number",
  "placement_and_spacing.inter_brow_distance.argument": "concise summary text",
  "placement_and_spacing.eyebrow_symmetry.score": "number",
  "placement_and_spacing.eyebrow_symmetry.argument": "concise summary text",
  "geometry_and_tilt.eyebrow_tilt": "value",
  "geometry_and_tilt.eyebrow_shape": "value",
  "geometry_and_tilt.tail_length.score": "number",
  "geometry_and_tilt.tail_length.argument": "concise summary text",
  "geometry_and_tilt.inner_start_shape": "value",
  "thickness_and_density.eyebrow_thickness.score": "number",
  "thickness_and_density.eyebrow_thickness.argument": "concise summary text",
  "thickness_and_density.eyebrow_density.score": "number",
  "thickness_and_density.eyebrow_density.argument": "concise summary text",
  "thickness_and_density.eyelash_density.score": "number",
  "thickness_and_density.eyelash_density.argument": "concise summary text",
  "thickness_and_density.hair_color": "value",
  "overall_brow_score.score": "number",
  "overall_brow_score.argument": "concise summary text"
}
```

## Output possibles renvoyés

- `geometry_and_tilt.eyebrow_tilt`: `negative | neutral | positive`
- `geometry_and_tilt.eyebrow_shape`: `straight | soft_arch | high_arch | rounded`
- `geometry_and_tilt.inner_start_shape`: `squared | rounded | faded`
- `thickness_and_density.hair_color`: `light_blonde | dark_blonde | red | light_brown | dark_brown | black | grey`

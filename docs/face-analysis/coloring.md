# coloring

## Worker key

- `coloring`

## Expected output fields v1

```json
{
  "skin.tone": "value",
  "skin.clarity.score": "number",
  "skin.clarity.argument": "concise summary text",
  "skin.evenness.score": "number",
  "skin.evenness.argument": "concise summary text",
  "hair.color": "value",
  "hair.depth.score": "number",
  "hair.depth.argument": "concise summary text",
  "hair.warmth.score": "number",
  "hair.warmth.argument": "concise summary text",
  "eyes.iris_color": "value",
  "eyes.iris_depth.score": "number",
  "eyes.iris_depth.argument": "concise summary text",
  "eyes.iris_saturation.score": "number",
  "eyes.iris_saturation.argument": "concise summary text",
  "eyes.whites_clarity.score": "number",
  "eyes.whites_clarity.argument": "concise summary text",
  "eyes.limbal_ring_visibility.score": "number",
  "eyes.limbal_ring_visibility.argument": "concise summary text",
  "eyebrows.color": "value",
  "eyebrows.depth.score": "number",
  "eyebrows.depth.argument": "concise summary text",
  "eyebrows.contrast_vs_skin.score": "number",
  "eyebrows.contrast_vs_skin.argument": "concise summary text",
  "lips.color": "value",
  "lips.saturation.score": "number",
  "lips.saturation.argument": "concise summary text",
  "contrast.hair_vs_skin.score": "number",
  "contrast.hair_vs_skin.argument": "concise summary text",
  "contrast.eyes_vs_skin.score": "number",
  "contrast.eyes_vs_skin.argument": "concise summary text",
  "contrast.brows_vs_skin.score": "number",
  "contrast.brows_vs_skin.argument": "concise summary text",
  "contrast.lips_vs_skin.score": "number",
  "contrast.lips_vs_skin.argument": "concise summary text",
  "contrast.overall_contrast_score.score": "number",
  "contrast.overall_contrast_score.argument": "concise summary text",
  "contrast.contrast_type": "value",
  "global_coloring_score.score": "number",
  "global_coloring_score.argument": "concise summary text"
}
```

## Output possibles renvoyés

- `skin.tone`: `very_fair | fair | medium | olive | tan | dark`
- `hair.color`: `black | dark_brown | medium_brown | light_brown | dark_blonde | blonde | red | grey | white`
- `eyes.iris_color`: `black | dark_brown | medium_brown | light_brown | hazel | green | blue_grey | blue | light_blue`
- `eyebrows.color`: `black | dark_brown | medium_brown | light_brown | blonde | grey`
- `lips.color`: `very_pale | pale_pink | pink | rose | red | deep_red | nude | dark`
- `contrast.contrast_type`: `high | medium | low`

# hair

## Worker key

- `hair`

## Expected output fields v1 (flat dot-path aggregates)

Les scores peuvent être émis comme nombre ou (selon pipeline) tableaux à un élément ; l’app les normalise via `getScore`.

```json
{
  "hair_quality_and_health.density.score": "number",
  "hair_quality_and_health.density.argument": "concise summary text",
  "hair_quality_and_health.shine_and_dryness.score": "number",
  "hair_quality_and_health.shine_and_dryness.argument": "concise summary text",
  "hair_quality_and_health.health_appearance.score": "number",
  "hair_quality_and_health.health_appearance.argument": "concise summary text",
  "hair_quality_and_health.uniformity.score": "number",
  "hair_quality_and_health.uniformity.argument": "concise summary text",
  "hair_characteristics.texture_type": "value",
  "hair_characteristics.curl_definition.score": "number",
  "hair_characteristics.curl_definition.argument": "concise summary text",
  "hair_characteristics.length_category": "value",
  "hairline.shape": "value",
  "hairline.symmetry.score": "number",
  "hairline.symmetry.argument": "concise summary text",
  "hairline.density.score": "number",
  "hairline.density.argument": "concise summary text",
  "hairline.recession_level.score": "number",
  "hairline.recession_level.argument": "concise summary text",
  "grooming_and_haircut.grooming_quality.score": "number",
  "grooming_and_haircut.grooming_quality.argument": "concise summary text",
  "grooming_and_haircut.haircut_control.score": "number",
  "grooming_and_haircut.haircut_control.argument": "concise summary text",
  "global_score.overall_hair_score.score": "number",
  "global_score.overall_hair_score.argument": "concise summary text"
}
```

## Structures JSON imbriquées

L’API peut aussi renvoyer des objets imbriqués (`hair_quality_and_health`, `grooming_and_haircut`, `global_score`, etc.) ; les lecteurs d’agrégats supportent les chemins pointés équivalents.

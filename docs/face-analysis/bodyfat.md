# bodyfat

## Worker key

- `bodyfat`

## Expected output fields v1

```json
{
  "lower_face_neck.jawline_definition.score": "number",
  "lower_face_neck.jawline_definition.argument": "concise summary text",
  "lower_face_neck.submental_fat_tightness.score": "number",
  "lower_face_neck.submental_fat_tightness.argument": "concise summary text",
  "midface_buccal.buccal_leanness.score": "number",
  "midface_buccal.buccal_leanness.argument": "concise summary text",
  "midface_buccal.zygomatic_bone_visibility.score": "number",
  "midface_buccal.zygomatic_bone_visibility.argument": "concise summary text",
  "upper_face_skin.periocular_leanness.score": "number",
  "upper_face_skin.periocular_leanness.argument": "concise summary text",
  "upper_face_skin.facial_angularity.score": "number",
  "upper_face_skin.facial_angularity.argument": "concise summary text",
  "body_fat_estimation.visual_estimate_tier": "value",
  "body_fat_estimation.facial_leanness_score.score": "number",
  "body_fat_estimation.facial_leanness_score.argument": "concise summary text"
}
```

## Output possibles renvoyés

- `body_fat_estimation.visual_estimate_tier`: `obese | overweight | average_soft | athletic_lean | model_shredded | extreme_gaunt`

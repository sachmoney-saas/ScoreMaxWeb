# Face Analysis API

This directory documents the ScoreMax face analysis contract used after onboarding.

## API surface

- Endpoint: `POST /v1/analyses`
- Request shape: `requestId`, `images[]`, `analyses[]`, `metadata?`
- Response shape: `requestId`, `createdAt`, `resultsByWorker[]`

The server contract is defined in `shared/oneshot.ts` and proxied through `server/routes/v1-analyses.ts`.

## Request template

```json
{
  "requestId": "uuid-or-business-id",
  "images": [
    {
      "imageId": "FACE_FRONT",
      "mimeType": "image/jpeg",
      "base64": "..."
    }
  ],
  "analyses": [
    {
      "worker": "age",
      "imageId": "FACE_FRONT",
      "promptVersion": "latest",
      "runs": 1
    }
  ],
  "metadata": {
    "source": "onboarding"
  }
}
```

## Common response envelope

```json
{
  "requestId": "uuid-or-business-id",
  "createdAt": "2026-04-27T12:00:00.000Z",
  "resultsByWorker": [
    {
      "worker": "age",
      "promptVersion": "v1",
      "provider": "scoremax",
      "requestedRuns": 1,
      "completedRuns": 1,
      "outputAggregates": {
        "age_analysis.best_estimated_age": 27,
        "age_analysis.age_argument": "Concise summary text",
        "skin_quality_and_plumpness.periorbital_freshness.score": 8,
        "skin_quality_and_plumpness.periorbital_freshness.argument": "Concise summary text"
      },
      "rawRuns": []
    }
  ]
}
```

## Output format v1

Each worker writes its structured values into `outputAggregates` using flattened dot-path keys. Most measurable traits now emit a pair of fields:

- `{path}.score`: numeric score
- `{path}.argument`: concise text explaining the score

Categorical fields remain direct `{path}: "value"`. Worker-level summary outputs follow the same convention when they are scored.

## Client display labels

The API keys above are technical contract keys and must stay stable in storage/API responses. Client-facing labels, value translations, ordering, and short interpretations are maintained in `client/src/lib/face-analysis-display.ts` and applied when rendering analysis results.

French (`fr`) is the default display locale today. The display metadata is locale-ready so additional languages can be added without renaming `outputAggregates` keys or changing stored/API payloads.

## Worker references

- [age.md](age.md)
- [bodyfat.md](bodyfat.md)
- [cheeks.md](cheeks.md)
- [chin.md](chin.md)
- [coloring.md](coloring.md)
- [ear.md](ear.md)
- [eye_brows.md](eye_brows.md)
- [eyes.md](eyes.md)
- [hair.md](hair.md)
- [jaw.md](jaw.md)
- [lips.md](lips.md)
- [neck.md](neck.md)
- [nose.md](nose.md)
- [skin.md](skin.md)
- [skin_tint.md](skin_tint.md)
- [smile.md](smile.md)
- [symmetry_shape.md](symmetry_shape.md)

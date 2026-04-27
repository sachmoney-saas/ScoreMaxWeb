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
      "promptVersion": "latest",
      "provider": "scoremax",
      "requestedRuns": 1,
      "completedRuns": 1,
      "outputAggregates": {},
      "rawRuns": []
    }
  ]
}
```

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

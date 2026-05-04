# FaceCaptureEngine — Plan d'implémentation

## Objectif
Système de capture faciale web (equivalant ARKit TrueDepth) avec détection de pose, masque 3D overlay et capture automatique des 8 photos.

## Stack
- **Detection**: MediaPipe Face Mesh (468 landmarks, temps réel)
- **Calcul pose**: Géométrie landmarks → yaw/pitch/roll
- **Rendu 3D**: Three.js + WebGL
- **Capture**: Canvas API + ImageCapture API
- **Framework**: React + TypeScript

## Architecture
```
FaceCaptureEngine/
├── types.ts           — Types, interfaces, definitions poses (done)
├── CameraManager.ts   — getUserMedia lifecycle (done)
├── FaceDetector.ts    — MediaPipe Face Mesh + pose computation (done)
├── PoseValidator.ts   — Scoring géométrie vs target pose (done)
├── MaskRenderer.ts    — Three.js overlay (done)
├── CaptureSession.ts  — State machine 8 poses (done)
├── useFaceCapture.ts  — React hook (done)
└── FaceCaptureView.tsx — UI component (done)
```

## État
- [x] Types et définitions des 8 poses (`types.ts`)
- [x] CameraManager (getUserMedia + ImageCapture fallback)
- [x] FaceDetector (MediaPipe Face Mesh + yaw/pitch/roll computation)
- [x] PoseValidator (scoring géométrique vs target pose)
- [x] MaskRenderer (Three.js overlay: midline, eye axis, oval, landmark dots)
- [x] CaptureSession (state machine + orchestration des 8 poses)
- [x] useFaceCapture hook (React integration)
- [x] FaceCaptureView component (full UI: pose guide, progress, thumbnails)
- [x] TypeScript: 0 erreurs
- [x] Bug fixes: singleton FaceDetector (plus d'overwrite onResults), refs initialisés après DOM mount
- [x] DA SaaS: pas d'emoji, design system tokens (DM Sans/Outfit, gradients glass, border-white/10)
- [x] Intégration NewAnalysis.tsx: bouton "Capturer avec la caméra" + preview 8 images avant upload
- [ ] Tests unitaires sur PoseValidator
- [ ] Tests d'intégration CaptureSession
- [ ] Tests E2E (Playwright)
- [ ] Demo standalone sans Supabase (local blob URLs)
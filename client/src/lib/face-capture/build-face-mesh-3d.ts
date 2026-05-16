// Normalise les landmarks MediaPipe en positions 3D centrées pour le hero onboarding.

import { mirrorLandmarksNormalizedX } from './admin-capture-guidelines';
import {
  FACEMESH_LEFT_EYE_CANTHUS_LATERAL,
  FACEMESH_RIGHT_EYE_CANTHUS_LATERAL,
} from './facemesh-feature-contours';
import { FACEMESH_CHIN_CENTER } from './facemesh-profile-jaw';
import type { LandmarkPoint } from './types';

export type HeroMetricHighlight = 'eyes' | 'jaw' | 'shape' | 'full';

export interface FaceMesh3DPositions {
  positions: Float32Array;
  landmarkCount: number;
}

/** Aligné sur `CaptureSession.MIN_LANDMARKS_FOR_PAYLOAD`. */
export const ONBOARDING_HERO_MIN_LANDMARKS = 100;

/** Construit un tampon `position` Three.js centré, mis à l’échelle par la distance inter-canthale. */
export function buildFaceMesh3DPositions(
  landmarks: LandmarkPoint[],
): FaceMesh3DPositions | null {
  if (landmarks.length < ONBOARDING_HERO_MIN_LANDMARKS) return null;

  const lm = mirrorLandmarksNormalizedX(landmarks);
  const rightLat = lm[FACEMESH_RIGHT_EYE_CANTHUS_LATERAL];
  const leftLat = lm[FACEMESH_LEFT_EYE_CANTHUS_LATERAL];
  const chin = lm[FACEMESH_CHIN_CENTER];

  let scale = 1;
  if (rightLat && leftLat) {
    const dx = leftLat.x - rightLat.x;
    const dy = leftLat.y - rightLat.y;
    const dz = (leftLat.z ?? 0) - (rightLat.z ?? 0);
    const iod = Math.hypot(dx, dy, dz);
    if (iod > 1e-6) scale = 1 / iod;
  }

  const cx = chin?.x ?? 0.5;
  const cy = chin?.y ?? 0.55;
  const cz = chin?.z ?? 0;
  const zScale = scale * 0.9;

  const positions = new Float32Array(lm.length * 3);
  for (let i = 0; i < lm.length; i++) {
    const p = lm[i]!;
    positions[i * 3] = (p.x - cx) * scale;
    positions[i * 3 + 1] = -(p.y - cy) * scale;
    positions[i * 3 + 2] = -((p.z ?? 0) - cz) * zScale;
  }

  return { positions, landmarkCount: lm.length };
}

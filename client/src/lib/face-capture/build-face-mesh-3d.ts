// Normalise les landmarks MediaPipe en positions 3D centrées pour le hero onboarding.

import { mirrorLandmarksNormalizedX } from './admin-capture-guidelines';
import {
  FACEMESH_LEFT_EYE_CANTHUS_LATERAL,
  FACEMESH_RIGHT_EYE_CANTHUS_LATERAL,
} from './facemesh-feature-contours';
import type { LandmarkPoint } from './types';

export type HeroMetricHighlight = 'eyes' | 'jaw' | 'shape' | 'full';

export interface FaceMesh3DPositions {
  positions: Float32Array;
  landmarkCount: number;
}

/** Aligné sur `CaptureSession.MIN_LANDMARKS_FOR_PAYLOAD`. */
export const ONBOARDING_HERO_MIN_LANDMARKS = 100;

/**
 * MediaPipe exagère souvent la profondeur en hero 3D : le visage paraît penché vers la caméra.
 * x/y restent en pixels ; seul z est atténué pour un rendu plus « de face ».
 */
export const HERO_MESH_DEPTH_SCALE = 0.55;

export type BuildFaceMesh3DFrame = {
  /** Largeur du JPEG / frame où les landmarks ont été détectés. */
  width: number;
  /** Hauteur du JPEG / frame où les landmarks ont été détectés. */
  height: number;
};

/**
 * MediaPipe : x normalisé par la largeur image, y par la hauteur.
 * Sans conversion pixel, un visage réel paraît étiré sur les JPEG non carrés.
 */
export function buildFaceMesh3DPositions(
  landmarks: LandmarkPoint[],
  frame?: BuildFaceMesh3DFrame,
): FaceMesh3DPositions | null {
  if (landmarks.length < ONBOARDING_HERO_MIN_LANDMARKS) return null;

  const lm = mirrorLandmarksNormalizedX(landmarks);
  const fw = Math.max(1, frame?.width ?? 1);
  const fh = Math.max(1, frame?.height ?? 1);

  const rightLat = lm[FACEMESH_RIGHT_EYE_CANTHUS_LATERAL];
  const leftLat = lm[FACEMESH_LEFT_EYE_CANTHUS_LATERAL];
  let scale = 1;
  if (rightLat && leftLat) {
    const dx = (leftLat.x - rightLat.x) * fw;
    const dy = (leftLat.y - rightLat.y) * fh;
    const dz = ((leftLat.z ?? 0) - (rightLat.z ?? 0)) * fw;
    const iod = Math.hypot(dx, dy, dz);
    if (iod > 1e-6) scale = 1 / iod;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of lm) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    const z = p.z ?? 0;
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  const positions = new Float32Array(lm.length * 3);
  for (let i = 0; i < lm.length; i++) {
    const p = lm[i]!;
    const xPx = (p.x - cx) * fw;
    const yPx = (p.y - cy) * fh;
    const zPx = ((p.z ?? 0) - cz) * fw;
    positions[i * 3] = xPx * scale;
    positions[i * 3 + 1] = -yPx * scale;
    positions[i * 3 + 2] = -zPx * scale * HERO_MESH_DEPTH_SCALE;
  }

  return { positions, landmarkCount: lm.length };
}

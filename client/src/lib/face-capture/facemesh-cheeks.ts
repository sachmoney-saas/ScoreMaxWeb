// ============================================================
// Polygones repère « joues » (frontal) — assemblage de morceaux
// MediaPipe Face Mesh (468 landmarks). Sens horaire sur l’image
// miroir : bord latéral ovale → bas joue → commissure / lèvre
// supérieure → aile du nez → paupière inférieure → retour tempe.
// ============================================================

import { FACEMESH_FACE_OVAL_ORDERED } from './facemesh-face-oval';
import {
  FACEMESH_LEFT_EYE_ORDERED,
  FACEMESH_LIP_OUTER_ORDERED,
  FACEMESH_RIGHT_EYE_ORDERED,
} from './facemesh-feature-contours';

function ringVerticesUnique(indices: readonly number[]): readonly number[] {
  if (indices.length >= 2 && indices[0] === indices[indices.length - 1]) {
    return indices.slice(0, -1);
  }
  return indices;
}

/** Sous-chaîne inclusive le long d’un anneau fermé (sens +1 modulo n). */
function subchainRingForward(
  ring: readonly number[],
  start: number,
  end: number,
): readonly number[] {
  const u = ringVerticesUnique(ring);
  const i0 = u.indexOf(start);
  const i1 = u.indexOf(end);
  if (i0 < 0 || i1 < 0) return [];
  const out: number[] = [start];
  let i = i0;
  while (i !== i1) {
    i = (i + 1) % u.length;
    out.push(u[i]!);
  }
  return out;
}

function concatUniqueChains(...parts: readonly (readonly number[])[]): readonly number[] {
  const out: number[] = [];
  for (const part of parts) {
    for (const idx of part) {
      if (out.length === 0 || out[out.length - 1] !== idx) {
        out.push(idx);
      }
    }
  }
  return out;
}

/** Paupière inférieure : canthus latéral → médial (œil droit du sujet). */
const RIGHT_EYE_LOWER_LID = subchainRingForward(
  FACEMESH_RIGHT_EYE_ORDERED,
  33,
  133,
);

/** Paupière inférieure : latéral → médial (œil gauche du sujet). */
const LEFT_EYE_LOWER_LID = subchainRingForward(
  FACEMESH_LEFT_EYE_ORDERED,
  263,
  362,
);

/** Lèvre supérieure droite : commissure → centre (17). */
const RIGHT_UPPER_LIP = subchainRingForward(FACEMESH_LIP_OUTER_ORDERED, 61, 17);

/** Lèvre supérieure gauche : commissure → centre (314). */
const LEFT_UPPER_LIP = subchainRingForward(FACEMESH_LIP_OUTER_ORDERED, 291, 314);

/**
 * Joue droite du sujet (côté image gauche en selfie miroir) :
 * tempe/malaire (454) → mandibule → commissure → philtrum latéral → nez → œil → retour.
 */
export const FACEMESH_RIGHT_CHEEK_GUIDE_ORDERED: readonly number[] = concatUniqueChains(
  subchainRingForward(FACEMESH_FACE_OVAL_ORDERED, 454, 365),
  [379, 378],
  RIGHT_UPPER_LIP,
  [4, 45, 220, 115, 48],
  RIGHT_EYE_LOWER_LID,
  subchainRingForward(FACEMESH_FACE_OVAL_ORDERED, 284, 454),
);

/**
 * Joue gauche du sujet : symétrique (ovale 234→172, lèvre 291, nez 4→278, œil 263).
 */
export const FACEMESH_LEFT_CHEEK_GUIDE_ORDERED: readonly number[] = concatUniqueChains(
  subchainRingForward(FACEMESH_FACE_OVAL_ORDERED, 234, 149),
  LEFT_UPPER_LIP,
  [4, 275, 440, 344, 278],
  LEFT_EYE_LOWER_LID,
  subchainRingForward(FACEMESH_FACE_OVAL_ORDERED, 127, 234),
);

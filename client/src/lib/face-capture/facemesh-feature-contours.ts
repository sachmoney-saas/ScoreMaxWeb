// ============================================================
// Boucles de landmarks MediaPipe (ordre de tracé) — lèvres, yeux,
// bas du nez. Source : `face_mesh_connections.py` (MediaPipe).
// ============================================================

/** Lèvre extérieure (bouche fermée), sens cyclique. */
export const FACEMESH_LIP_OUTER_ORDERED: number[] = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61,
];

/** Lèvre intérieure, sens cyclique. */
export const FACEMESH_LIP_INNER_ORDERED: number[] = [
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191, 78,
];

export const FACEMESH_LEFT_EYE_ORDERED: number[] = [
  263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263,
];

export const FACEMESH_RIGHT_EYE_ORDERED: number[] = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33,
];

/**
 * Sillons / base du nez (une boucle : aile → columelle → aile), arêtes du graphe `FACEMESH_NOSE`.
 */
export const FACEMESH_NOSE_BOTTOM_ORDERED: number[] = [
  48, 115, 220, 45, 4, 275, 440, 344, 278, 294, 327, 326, 2, 97, 98, 64, 48,
];

export const FACEMESH_FEATURE_CONTOURS_ORDERED: readonly number[][] = [
  FACEMESH_LIP_OUTER_ORDERED,
  FACEMESH_LIP_INNER_ORDERED,
  FACEMESH_LEFT_EYE_ORDERED,
  FACEMESH_RIGHT_EYE_ORDERED,
  FACEMESH_NOSE_BOTTOM_ORDERED,
];

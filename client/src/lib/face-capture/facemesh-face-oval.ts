// ============================================================
// Contour ovale MediaPipe : ordre cyclique (voir MaskRenderer).
// ============================================================

export const FACEMESH_FACE_OVAL_ORDERED: readonly number[] = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234,
  127, 162, 21, 54, 103, 67, 109,
];

/**
 * Sous-chemin du bas de l’ovale (mandibule + menton), dans l’ordre de `FACEMESH_FACE_OVAL_ORDERED`.
 * Avec la tête relevée (pose jaw-up), une extension **symétrique** en indices (323/361 vs 127/162)
 * ne donne pas la même hauteur à l’écran : le côté image **droit** montait trop (127→162).
 * On corrige de façon **asymétrique** : un pas de plus vers la tempe à gauche (**454** avant 323) et
 * on termine à **234** sans 127/162 pour ne pas surélever la fin de ligne à droite.
 */
export const FACEMESH_FACE_OVAL_JAW_LOWER_ARC_ORDERED: readonly number[] = [
  454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234,
];

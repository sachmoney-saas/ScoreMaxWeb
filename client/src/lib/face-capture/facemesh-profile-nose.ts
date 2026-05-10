// ============================================================
// Silhouette nez « vue profil » : suites d’indices issus de
// `FACEMESH_NOSE` (mediapipe face_mesh_connections).
// — profile-left  : hémicycle mâchoire 397 → chaîne côté narinaire gauche.
// — profile-right : hémicycle 172 → chaîne côté narinaire droit.
// ============================================================

/** Du radier (168) vers l’aile / base narinaire gauche (98). */
export const FACEMESH_PROFILE_LEFT_VISIBLE_NOSE_ORDERED: readonly number[] = [
  168, 6, 197, 195, 5, 4, 45, 220, 115, 48, 64, 98,
];

/** Du radier (168) vers l’aile / appui narinaire droit (327). */
export const FACEMESH_PROFILE_RIGHT_VISIBLE_NOSE_ORDERED: readonly number[] = [
  168, 6, 197, 195, 5, 4, 275, 440, 344, 278, 294, 327,
];

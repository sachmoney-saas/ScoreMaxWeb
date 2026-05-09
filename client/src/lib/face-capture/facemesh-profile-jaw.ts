// ============================================================
// Arc mâchoire « vue profil » admin : sous-chaînes de FACEMESH_FACE_OVAL_ORDERED.
// Deux chemins 397↔152 et 172↔152 sur le bas d’ovale. Choix pose → chaîne dans
// drawAdminProfileJawGuideOnCanvas (profil droit → 172…152, profil gauche → 397…152).
//
//   172 → … → 152  : demi-ovale côté indice 172
//   397 → … → 152  : demi-ovale côté indice 397
// ============================================================

/** Demi-ovale 172 → menton (152) ; pose profile-right. */
export const FACEMESH_JAW_RIGHT_HEMISPHERE_TO_CHIN_ORDERED: readonly number[] = [
  172, 136, 150, 149, 176, 148, 152,
];

/** Demi-ovale 397 → menton (152) ; pose profile-left. */
export const FACEMESH_JAW_LEFT_HEMISPHERE_TO_CHIN_ORDERED: readonly number[] = [
  397, 365, 379, 378, 400, 377, 152,
];

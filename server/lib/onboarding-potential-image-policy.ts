/** Statuts persistés pour une génération d'image potentiel onboarding. */
export type PotentialGenerationStatus = "pending" | "completed" | "failed";

export type PotentialGenerationSnapshot = {
  status: PotentialGenerationStatus;
  hasOneshotJob: boolean;
  hasStoredResult: boolean;
};

/**
 * Indique si un nouvel appel OneShot doit être créé.
 * - `completed` avec fichier → jamais
 * - `pending` avec job → attendre le job en cours
 * - `failed` ou pending orphelin → autoriser une nouvelle tentative
 */
export function shouldStartNewPotentialImageGeneration(
  existing: PotentialGenerationSnapshot | null,
): boolean {
  if (!existing) {
    return true;
  }

  if (existing.status === "completed" && existing.hasStoredResult) {
    return false;
  }

  if (existing.status === "pending" && existing.hasOneshotJob) {
    return false;
  }

  return true;
}

/** Priorité d'affichage : completed > pending actif > failed récent. */
export function pickPreferredPotentialGeneration<
  T extends { status: PotentialGenerationStatus; createdAtMs: number },
>(rows: readonly T[]): T | null {
  if (rows.length === 0) {
    return null;
  }

  const completed = rows
    .filter((r) => r.status === "completed")
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  if (completed[0]) {
    return completed[0];
  }

  const pending = rows
    .filter((r) => r.status === "pending")
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  if (pending[0]) {
    return pending[0];
  }

  const failed = rows
    .filter((r) => r.status === "failed")
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  return failed[0] ?? null;
}

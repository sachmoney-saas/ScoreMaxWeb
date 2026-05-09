/** Clé localStorage : outils capture admin (pause, aplatis, HUD) — sensé si `role === admin`. */
export const ADMIN_CAPTURE_UX_STORAGE_KEY = "scoreMax_admin_capture_ux_v1";

export function readAdminCaptureUxEnabledFromStorage(): boolean {
  try {
    return window.localStorage.getItem(ADMIN_CAPTURE_UX_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function writeAdminCaptureUxEnabledToStorage(enabled: boolean): void {
  try {
    window.localStorage.setItem(ADMIN_CAPTURE_UX_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* private mode / quota */
  }
}

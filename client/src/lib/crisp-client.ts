/** Identifiant site Crisp (widget chat). */
export const CRISP_WEBSITE_ID = "c21924b5-1596-478c-9384-67d8edaa4431";

export const CRISP_SCRIPT_ID = "crisp-support-chat-script";

declare global {
  interface Window {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
  }
}

export function crispPush(command: unknown[]): void {
  window.$crisp = window.$crisp ?? [];
  (window.$crisp as unknown[]).push(command);
}

/** Charge le script Crisp si besoin ; idempotent. */
export function initCrispWebsite(): Promise<void> {
  return new Promise((resolve) => {
    window.$crisp = window.$crisp ?? [];
    window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;

    const existing = document.getElementById(CRISP_SCRIPT_ID);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = CRISP_SCRIPT_ID;
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

/**
 * App version.
 *
 * Single source of truth: public/version.json.
 * The value is baked into the bundle at build time (APP_VERSION) and also
 * served live at /version.json, so the installed app can compare the two.
 * Bump public/version.json only — never hardcode the number here.
 */
import versionJson from "../../public/version.json";

export const APP_VERSION: number = versionJson.version;


const DECLINED_KEY = "splittrip:declined-version";

export async function fetchPublishedVersion(): Promise<number | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as { version?: number };
    return typeof body.version === "number" ? body.version : null;
  } catch {
    return null;
  }
}

export function getDeclinedVersion(): number {
  if (typeof localStorage === "undefined") return 0;
  return Number(localStorage.getItem(DECLINED_KEY) ?? 0) || 0;
}

export function setDeclinedVersion(version: number) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DECLINED_KEY, String(version));
}

/** Refreshes the cached app shell and reloads into the new version. */
export async function applyAppUpdate() {
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((key) => caches.delete(key)));
    }
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((registration) => registration.update()));
      // Let a freshly installed worker take control so the reload serves the new bundle.
      for (const registration of registrations) {
        registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      }
    }
  } catch {
    // Best effort — reload anyway.
  }
  window.location.reload();
}


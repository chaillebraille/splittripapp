/**
 * App version.
 *
 * Bump APP_VERSION and public/version.json together on every publish.
 * The installed app compares its baked-in APP_VERSION with the published
 * /version.json to decide whether an update is available.
 */
export const APP_VERSION = 1;

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
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((registration) => registration.update()));
    }
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Best effort — reload anyway.
  }
  window.location.reload();
}

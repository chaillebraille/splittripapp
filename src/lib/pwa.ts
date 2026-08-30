/**
 * Single guarded registrar for the offline app-shell service worker.
 * Never registers in dev, inside an iframe, or in Lovable previews.
 */
const SW_URL = "/sw.js";

function isPreviewHost(hostname: string) {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

async function unregisterAppServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((registration) => (registration.active?.scriptURL ?? "").endsWith(SW_URL))
      .map((registration) => registration.unregister()),
  );
}

export function registerAppServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const refused =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    isPreviewHost(window.location.hostname) ||
    new URLSearchParams(window.location.search).get("sw") === "off";

  if (refused) {
    void unregisterAppServiceWorker();
    return;
  }

  void navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch((error) => {
    console.error("Service worker registration failed", error);
  });
}

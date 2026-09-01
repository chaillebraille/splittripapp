# Fix: new PWA icon not showing on installed apps

## Diagnosis (verified)

- **No server-side or publishing problem.** The published site serves the new icon: `/icon-192-v3.png` and `/icon-512-v3.png` on `pocket-splurge-sync.lovable.app` are byte-identical (matching md5) to the new jigsaw/dollar artwork, and `/manifest.webmanifest` correctly references them. `version.json` is 12 both locally and published.
- **No stale references.** The only icon references in code are the `-v3` files (manifest + `apple-touch-icon` in `__root.tsx`); no old icon paths remain.

## Actual cause: client-side icon caching (two layers)

1. **Android WebAPK / iOS home screen:** the home-screen icon is baked at install time by the OS. Chrome re-checks the manifest only periodically (roughly daily, on app launch), so an already-installed app keeps the old icon even after the site is updated. New-icon URLs (the `-v3` rename) are the documented trigger for a refresh, but it is not instant.
2. **The app's own service worker** precaches `manifest.webmanifest` and the PNG icons (globPatterns includes them). Until the installed app updates to the latest build, even its manifest/icon requests are served from the old precache.

"New device" installs that still show the old icon were installed while the published build (or that device's SW/precache) still had the old icon, or via an install banner captured earlier.

## Changes

1. **Manifest cleanup** (`public/manifest.webmanifest`): change icon `purpose` from `"any maskable"` to `"any"` — the edge-to-edge artwork is not maskable-safe (the puzzle outline gets cropped into a circle/squircle), which can also make the icon look wrong/old on Android.
2. **Bump version** to 13 (`public/version.json`) so every installed client is pushed a new service worker with a fresh precache containing the new manifest and icons.
3. **Publish** the app after the change (frontend changes go live only via Publish → Update).

## What the user should do after publishing

- Open the installed app once so it self-updates to v13.
- **Uninstall the PWA from the home screen and reinstall it** (Android WebAPK and iOS only regenerate the icon on reinstall, or after Chrome's delayed manifest refresh — reinstalling is immediate and certain).

## Technical notes

- No code path, header, or config change can force a phone's launcher to replace an already-created home-screen icon; only reinstall (or waiting for the OS refresh) does.
- Preview/publish checks performed: md5 comparison of published vs local icon files, manifest content fetch, version.json comparison, icon file listing, and a full-text search for stale icon references.

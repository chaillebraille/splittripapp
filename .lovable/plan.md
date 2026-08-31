# SplitTrip backlog

## 1. App icon

Generate a new icon and replace `public/icon-192.png`, `public/icon-512.png` and `public/favicon.png`:
current icon artwork as background, a large dark green dollar sign on top, and a medium light-brown outline of a 4-piece jigsaw puzzle spanning edge to edge above it.

## 2. Users page

- The share link and its QR code use the site root (no trailing `/auth`).
- Usernames keep the casing they were typed with, but two accounts may not differ only in case, and login matches case-insensitively. Implemented by matching on a lowercased key (the internal address derived from a username is already lowercased, which gives uniqueness and case-insensitive login for free); creation additionally rejects a name whose lowercase form already exists, with a clear message.

## 3. User profile page

- Home page: the sign-out icon becomes a user-profile icon leading to a new `/profile` page.
- The profile page shows the username, an editable "Member name" field (defaults to the username), and the sign-out control with the existing confirmation.
- The member name is stored on the user's profile record in the backend and cached locally so it works offline.
- Creating a trip pre-creates one member using that default member name.
- The member name is not shown or edited on the Users (admin) page.

## 4. Version numbering and updates

- Each published build carries an incremental integer version, kept in a source file and written into a small `version.json` served by the app.
- Tapping "SplitTrip" on the home page opens an info dialog showing the installed version. When online, it fetches the published `version.json`; if that number is higher, an Update button is enabled. Update refreshes the app shell (service-worker update + reload).
- During sync, the app checks for a higher published version and asks once whether to update. The highest version the user declined is remembered locally, so the prompt only reappears for a still-higher version. The dialog's Update button ignores that memory.

## 5. Icons cleanup

- Remove the non-functional "More" item at the bottom right of the home page.

## 6. Share trip

- Invite links show "View <trip name> — SplitTrip" for view links and "Join <trip name> — SplitTrip" for edit links, both as page title and link-preview text. This needs the invite page to resolve the trip name from the code before sign-in, via a public read that exposes only the trip name and role for a valid, non-revoked invite.
- Viewers can open an expense in a read-only view (same layout as the edit page, fields disabled, no save/delete).
- Viewers and editors (not the owner) see a "Remove" action on the trip profile page, presented like the owner's Delete: with confirmation, it drops their share of the trip and removes their local copy of its data. It is reversible — clicking a valid view/edit link again re-adds them.

## Technical notes

- Backend changes: `profiles` gains a default member-name column; a case-insensitive uniqueness guard on usernames; a security-definer function returning `{ trip name, role }` for an invite code (callable before joining); a policy/path letting a non-owner delete their own `group_shares` row (already present) plus a server function wrapping it.
- Version data: `src/version.ts` (single source), emitted to `public`/build output as `version.json`; local "declined version" stored in the existing local store.
- Read-only expense view reuses the existing expense form component behind a `readOnly` flag rather than a duplicated page.
- Removal of a shared trip clears that trip's rows from the device's local store and skips re-adding them on the next sync.

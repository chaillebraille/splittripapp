# Multi-user SplitTrip with admin-provisioned accounts and trip sharing

Turn the app from one anonymous identity per device into real accounts that you provision,
where each person sees only their own trips, plus explicit per-trip sharing with two roles.

## Accounts (no public signup)

- Email + password sign-in only. Self-signup is switched off at the auth level, so nobody
  can create an account on your paid backend by downloading the app.
- You get an **admin** area (`/admin`) where you can:
  - create a user: email + display name, with a generated initial password shown once for you
    to pass on to that person;
  - reset a user's password (generate a new one);
  - list users and deactivate/delete them.
- Admin status is stored in a dedicated roles table (never on the profile), checked server-side.
  You are seeded as the first admin.
- A `/auth` page with email + password sign-in and "change my password" for regular users.
  No "create account" link, no email confirmation loop, no password-reset-by-email (you reset).
- All existing data is wiped as part of this change, so everyone starts clean.

## Sharing a trip

- The trip owner (the account that created it) opens the trip profile page and generates a
  **share link/code** with a chosen role:
  - **Read-only** — can see the trip, its members, expenses and settle suggestions; cannot change anything.
  - **Can edit** — can add/edit/delete expenses.
- Anyone signed in who opens the link joins the trip in that role. The owner sees a list of
  people the trip is shared with, can change a person's role, and can revoke access.
- Regardless of role, only the **owner** can rename/delete the trip, change the settle currency
  or the trip photo, add/remove members, and manage sharing.
- Links can be revoked and optionally expire; a revoked link stops working immediately.

## No name collisions between owners

Nothing is keyed by name. Every trip, member, expense and split has its own global identifier
and its own owning trip, so your trip "A" and someone else's trip "A" — or two members both
named "A" — are entirely separate rows that simply both become visible to you. The on-device
offline database is also stored per signed-in account, so switching accounts on a shared phone
never mixes the two datasets.

## Offline-first stays as it is

- Local-first writes, the outbox, opportunistic sync, the sync badge and manual retry are all kept.
- The cloud snapshot pull now returns owned **and** shared trips, so a shared trip appears on
  your device and works offline like your own.
- If you only have read access, the app hides editing controls; should a stale queued edit still
  reach the server it is rejected there and dropped from the queue with a clear message, rather
  than jamming sync.
- Signing out clears the on-device store for that account; signing in re-pulls from the cloud.

## Technical detail

**Database**
- `profiles` (user_id, email, display_name) with an insert-on-signup trigger.
- `app_role` enum (`admin`, `user`) + `user_roles` table + `has_role(uuid, app_role)` security-definer function.
- `group_shares` (group_id, user_id, role `viewer`|`editor`, created_at) — unique on (group_id, user_id).
- `group_invites` (id, group_id, code, role, created_by, expires_at, revoked_at, uses).
- Security-definer helpers used by every policy to avoid recursive RLS:
  - `can_read_group(gid)` = owner OR row in `group_shares`
  - `can_write_group(gid)` = owner OR share role = `editor`
  - `is_group_owner(gid)`
- Rewrite RLS on `groups`, `members`, `expenses`, `expense_splits`:
  - read via `can_read_group`
  - expense/split writes via `can_write_group`
  - group update/delete and member writes via `is_group_owner`
  - `group_shares`/`group_invites` readable by owner and the shared-with user; writable by owner only.
- GRANTs for `authenticated` and `service_role` on all new tables.
- Delete all existing rows in `expense_splits`, `expenses`, `members`, `groups`.

**Auth config**
- `disable_signup: true`, `external_anonymous_users_enabled: false`, `auto_confirm_email: true`
  (admin-created accounts have no mailbox verification step).

**Server functions**
- `src/lib/admin.functions.ts` — `listUsers`, `createUser`, `resetUserPassword`, `deleteUser`;
  each verifies `has_role(caller, 'admin')` through the caller's own client first, then loads
  `supabaseAdmin` inside the handler for the Auth Admin API call.
- `src/lib/sharing.functions.ts` — `createInvite`, `listShares`, `redeemInvite`, `updateShareRole`, `revokeShare`.
- `pullAll` extended to include shared trips and a per-trip `role` for the current user.
- Existing group/member/expense functions keep their idempotent upsert behaviour; RLS now decides
  permission, and a permission failure is surfaced as a non-retryable sync error.

**Client**
- Replace anonymous sign-in in `src/lib/auth-provider.tsx` with a real session; unauthenticated
  users land on `/auth`.
- IndexedDB record key becomes `state:<user_id>`; sign-out drops the in-memory state.
- `LocalGroup` gains `owner_id` and `role`; trip profile, member editing, expense create/edit and
  delete controls are gated on the role.
- New routes: `/auth`, `/admin`, `/join/$code`; trip profile gets a "Share this trip" section.

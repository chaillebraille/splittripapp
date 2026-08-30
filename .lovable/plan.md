# Cost-Splitting App Build Plan

## Overview
Build a scaled-down, mobile-first cost-splitting PWA using the **Serene Organic Minimal** design direction. The app runs on Android and iPhone via home-screen install, keeps data in Lovable Cloud, and focuses on the essentials: groups, expenses, balances, and settle-up.

## Design Direction
- Warm organic palette: cream, sand, clay, sage green, soft ink.
- Fonts: Dancing Script (display accents) + Nunito (UI).
- Rounded, friendly cards, generous touch targets, bottom navigation.
- Mobile-first layout centered in a max-width container.

## Features (scaled-down)
1. **Home dashboard**
   - Balance hero card: "You are owed" / "You owe" / "All settled".
   - Quick-add expense input.
   - Recent expenses feed.
   - Per-person balances list.
2. **Trips/Travels**
   - Create a group with a name and a main settle-currency. Expenses can be entered in any currency; each is converted to the settle-currency using one rate per trip (fetched when the expense is first added and cached for the group, since trips are ~a week long), with the proposed rate editable per expense.
   - Add/remove members (name + initial); individuals from previous groups are suggested when adding members to a new group.
   - Switch between groups.
3. **Expenses**
   - Add expense: amount, description, date (defaults to today, editable), payer, flexible split (equal among all by default, deselect individuals, or enter custom amounts).
   - Delete expense.
4. **Settle up**
   - Suggested minimal payments to balance the group.
   - Mark a payment as settled.
5. **PWA**
   - `manifest.webmanifest` for home-screen install.
   - Theme color, app icons, standalone display.
   - No offline service worker (manifest-only unless you ask for offline).

## Technical Plan
- **Backend**: Lovable Cloud (PostgreSQL) with RLS policies.
- **Tables**: `groups`, `members`, `expenses`, `expense_splits`, `settlements`.
- **Server functions**: `createServerFn` for CRUD and balance calculations.
- **Frontend**: TanStack Router, React, Tailwind CSS v4, shadcn/ui primitives.
- **Routes**:
  - `/` — dashboard
  - `/groups/new` — create group
  - `/groups/:groupId` — group dashboard
  - `/groups/:groupId/expenses/new` — add expense
  - `/groups/:groupId/settle` — settle up

## Out of Scope
- Authentication/login gates (data is per-device/local-anon for simplicity unless you want accounts).
- Receipt photos, chat, percentages, unequal splits, multi-currency per expense.
- Offline caching beyond installability.

## Next Step
Approve this plan and I'll build the app end-to-end.

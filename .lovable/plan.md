# Read-only expense view with explicit Edit mode

## Goal
Clicking an expense in any list always opens it in read-only view. The trip owner and editors can switch to Edit mode via a pencil icon; viewers always stay read-only.

## Changes — `src/routes/groups/$groupId/expenses/$expenseId/edit.tsx`

1. **Default to view mode**: add local state `editing` (initially `false`). All form fields are disabled unless `editing && canEdit`, so the page opens fully read-only for everyone.

2. **Header**:
   - Title shows **"View expense"** in read-only mode and **"Edit expense"** while editing.
   - A **pencil (edit) icon** is placed top-left, immediately to the right of the Back button. It is only rendered for the trip owner and editors (`canEdit`), never for viewers. Tapping it enters Edit mode.

3. **Edit mode behavior**:
   - All fields become editable (amount, currency, description, date, payer, splits) — reusing the existing form exactly as it works today.
   - The Save button and delete (waste basket) action are only shown in Edit mode.
   - The pencil icon is hidden while editing (page is already in Edit mode).
   - After a successful save, the page returns to View mode (staying on the expense, as today).

4. **Viewers**: see the read-only page with no pencil, no Save, no delete — unchanged permission logic (`my_role` from the trip data).

## Notes
- No new route is needed; the existing expense page handles both modes.
- The direct URL to the page still opens in View mode for everyone, including the owner.
- Offline-first behavior is unchanged — editing still writes locally and syncs opportunistically.

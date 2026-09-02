# Expense amount re-modelling

Make split amounts the single source of truth. An expense no longer stores its own total, and no settle amount is stored anywhere — both are derived.

## New model

- Expense keeps: currency, exchange_rate, description, date, payer.
- Expense drops: amount, settle_amount.
- A split's `amount` is in the **expense currency** (today it is stored in the trip settle currency — existing rows get converted).
- Derived, always the same way:
  - split settle amount = round(split.amount × exchange_rate, 2)
  - expense total amount = sum of split amounts
  - expense total settle amount = sum of split settle amounts
  - (the total settle amount may differ by a cent from total × rate — accepted by design)

## Expense page behaviour (Create / View / Edit)

- Total amount field: filled on load from the sum of split amounts; editable by the user on Create/Edit.
- Total settle amount (read-only): on load = sum of split settle amounts; after the user edits the total amount, or after the exchange rate changes (currency switch or manual entry) = total amount × rate, rounded to 2 decimals.
- Each split row shows its own read-only settle amount = round(split amount × rate, 2), recalculated whenever the split amount or the rate changes.
- Save is still blocked unless the sum of split amounts equals the total amount field; splits of 0.00 are still dropped on save.

## Other UI updated to the new truth

- Trip dashboard total expense, expense lists, member page (total paid, balance, "your share"), settle/balance calculations: all derive from split amounts × the expense rate instead of the stored settle_amount.
- Balances: a payer is credited the expense's derived total settle amount; each member owes their split's derived settle amount.

## Technical notes

- Database migration: convert every existing `expense_splits.amount` from settle currency back to expense currency (`round(amount / exchange_rate, 2)`), then drop `expenses.amount` and `expenses.settle_amount`.
- Shared helpers (new small module) for `splitSettleAmount`, `expenseTotal`, `expenseSettleTotal` so every surface rounds identically.
- Touched code: local store types and `src/lib/data/expenses.ts` / `balances.ts`, server fns `expenses.functions.ts`, `balances.functions.ts`, `sync.functions.ts`, sync engine, `ExpenseList`, trip index, member page, settle page, expense new/edit routes.
- Offline data already on devices is re-hydrated from the server snapshot after the migration; local pending edits made before the change are not converted.

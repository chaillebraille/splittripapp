import {
  enqueue,
  getState,
  newId,
  ready,
  setState,
  type LocalExpense,
  type LocalMember,
  type LocalSplit,
} from "@/lib/local/store";
import { requestSync } from "@/lib/local/sync";

export type ExpenseWithSplits = LocalExpense & {
  expense_splits: LocalSplit[];
  payer: LocalMember | null;
};

type SplitInput = { member_id: string; amount: number };

function hydrate(expense: LocalExpense): ExpenseWithSplits {
  const state = getState();
  return {
    ...expense,
    expense_splits: state.splits.filter((s) => s.expense_id === expense.id),
    payer: state.members.find((m) => m.id === expense.payer_id) ?? null,
  };
}

export async function listExpenses({
  data,
}: {
  data: { group_id: string };
}): Promise<ExpenseWithSplits[]> {
  await ready();
  return getState()
    .expenses.filter((e) => e.group_id === data.group_id)
    .sort(
      (a, b) =>
        b.expense_date.localeCompare(a.expense_date) || b.created_at.localeCompare(a.created_at),
    )
    .map(hydrate);
}

export async function getExpense({
  data,
}: {
  data: { id: string };
}): Promise<ExpenseWithSplits | null> {
  await ready();
  const expense = getState().expenses.find((e) => e.id === data.id);
  return expense ? hydrate(expense) : null;
}

function persistExpense(expense: LocalExpense, splitInputs: SplitInput[]) {
  const splits: LocalSplit[] = splitInputs.map((split) => ({
    id: newId(),
    expense_id: expense.id,
    member_id: split.member_id,
    amount: split.amount,
  }));

  setState((s) =>
    enqueue(
      {
        ...s,
        expenses: [...s.expenses.filter((e) => e.id !== expense.id), expense],
        splits: [...s.splits.filter((sp) => sp.expense_id !== expense.id), ...splits],
      },
      { kind: "expense.upsert", payload: { expense, splits } },
    ),
  );
  requestSync();
}

export async function createExpense({
  data,
}: {
  data: {
    group_id: string;
    amount: number;
    currency: string;
    exchange_rate: number;
    description: string;
    expense_date: string;
    payer_id: string;
    splits: SplitInput[];
  };
}): Promise<LocalExpense> {
  await ready();
  const expense: LocalExpense = {
    id: newId(),
    group_id: data.group_id,
    amount: data.amount,
    currency: data.currency.toUpperCase(),
    exchange_rate: data.exchange_rate,
    settle_amount: Number((data.amount * data.exchange_rate).toFixed(4)),
    description: data.description.trim(),
    expense_date: data.expense_date,
    payer_id: data.payer_id,
    created_at: new Date().toISOString(),
  };
  persistExpense(expense, data.splits);
  return expense;
}

export async function updateExpense({
  data,
}: {
  data: {
    id: string;
    amount?: number;
    currency?: string;
    exchange_rate?: number;
    description?: string;
    expense_date?: string;
    payer_id?: string;
    splits?: SplitInput[];
  };
}): Promise<LocalExpense> {
  await ready();
  const existing = getState().expenses.find((e) => e.id === data.id);
  if (!existing) throw new Error("Expense not found");

  const updated: LocalExpense = {
    ...existing,
    ...(data.amount !== undefined ? { amount: data.amount } : {}),
    ...(data.currency !== undefined ? { currency: data.currency.toUpperCase() } : {}),
    ...(data.exchange_rate !== undefined ? { exchange_rate: data.exchange_rate } : {}),
    ...(data.description !== undefined ? { description: data.description.trim() } : {}),
    ...(data.expense_date !== undefined ? { expense_date: data.expense_date } : {}),
    ...(data.payer_id !== undefined ? { payer_id: data.payer_id } : {}),
  };
  updated.settle_amount = Number((updated.amount * updated.exchange_rate).toFixed(4));

  const splits =
    data.splits ??
    getState()
      .splits.filter((s) => s.expense_id === data.id)
      .map((s) => ({ member_id: s.member_id, amount: s.amount }));

  persistExpense(updated, splits);
  return updated;
}

export async function deleteExpense({ data }: { data: { id: string } }) {
  await ready();
  setState((s) =>
    enqueue(
      {
        ...s,
        expenses: s.expenses.filter((e) => e.id !== data.id),
        splits: s.splits.filter((sp) => sp.expense_id !== data.id),
      },
      { kind: "expense.delete", payload: { id: data.id } },
    ),
  );
  requestSync();
  return { success: true };
}

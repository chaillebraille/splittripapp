import { getState, ready } from "@/lib/local/store";

export type Balance = {
  member_id: string;
  name: string;
  initial: string;
  paid: number;
  owed: number;
  net: number;
};

export type PaymentSuggestion = {
  from: { id: string; name: string; initial: string };
  to: { id: string; name: string; initial: string };
  amount: number;
};

export async function getBalances({ data }: { data: { group_id: string } }) {
  await ready();
  const state = getState();
  const members = state.members.filter((m) => m.group_id === data.group_id);
  const expenses = state.expenses.filter((e) => e.group_id === data.group_id);
  const expenseIds = new Set(expenses.map((e) => e.id));
  const splits = state.splits.filter((s) => expenseIds.has(s.expense_id));

  const balances = new Map<string, { paid: number; owed: number }>();
  for (const member of members) balances.set(member.id, { paid: 0, owed: 0 });

  for (const expense of expenses) {
    const entry = balances.get(expense.payer_id);
    if (entry) entry.paid += Number(expense.settle_amount ?? expense.amount * expense.exchange_rate);
  }
  for (const split of splits) {
    const entry = balances.get(split.member_id);
    if (entry) entry.owed += Number(split.amount);
  }

  const balanceList: Balance[] = members.map((member) => {
    const entry = balances.get(member.id)!;
    return {
      member_id: member.id,
      name: member.name,
      initial: member.initial ?? "",
      paid: entry.paid,
      owed: entry.owed,
      net: Number((entry.paid - entry.owed).toFixed(4)),
    };
  });

  // Greedy creditor/debtor matching keeps the number of transfers minimal.
  const suggestions: PaymentSuggestion[] = [];
  const debtors = balanceList
    .filter((b) => b.net < -0.01)
    .map((b) => ({ ...b, remaining: Math.abs(b.net) }))
    .sort((a, b) => b.remaining - a.remaining);
  const creditors = balanceList
    .filter((b) => b.net > 0.01)
    .map((b) => ({ ...b, remaining: b.net }))
    .sort((a, b) => b.remaining - a.remaining);

  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]!;
    const creditor = creditors[creditorIndex]!;
    const amount = Math.min(debtor.remaining, creditor.remaining);

    suggestions.push({
      from: { id: debtor.member_id, name: debtor.name, initial: debtor.initial },
      to: { id: creditor.member_id, name: creditor.name, initial: creditor.initial },
      amount: Number(amount.toFixed(2)),
    });

    debtor.remaining -= amount;
    creditor.remaining -= amount;
    if (debtor.remaining < 0.01) debtorIndex++;
    if (creditor.remaining < 0.01) creditorIndex++;
  }

  return {
    balances: balanceList,
    totalOwed: balanceList.filter((b) => b.net > 0).reduce((sum, b) => sum + b.net, 0),
    totalOwes: balanceList.filter((b) => b.net < 0).reduce((sum, b) => sum + Math.abs(b.net), 0),
    suggestions,
  };
}

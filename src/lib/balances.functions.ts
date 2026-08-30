import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export const getBalances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ group_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: members, error: membersError } = await context.supabase
      .from("members")
      .select("id, name, initial")
      .eq("group_id", data.group_id);

    if (membersError) throw new Error(membersError.message);

    const { data: expenses, error: expensesError } = await context.supabase
      .from("expenses")
      .select("amount, exchange_rate, settle_amount, payer_id, expense_splits(member_id, amount)")
      .eq("group_id", data.group_id);

    if (expensesError) throw new Error(expensesError.message);

    const memberMap = new Map<string, { name: string; initial: string }>();
    for (const m of members ?? []) {
      memberMap.set(m.id, { name: m.name, initial: m.initial ?? "" });
    }

    const balances = new Map<string, { paid: number; owed: number }>();
    for (const id of memberMap.keys()) {
      balances.set(id, { paid: 0, owed: 0 });
    }

    for (const expense of expenses ?? []) {
      const payerId = expense.payer_id;
      if (payerId && balances.has(payerId)) {
        balances.get(payerId)!.paid += Number(expense.settle_amount ?? expense.amount / expense.exchange_rate);
      }
      for (const split of (expense.expense_splits ?? []) as { member_id: string; amount: number }[]) {
        if (balances.has(split.member_id)) {
          balances.get(split.member_id)!.owed += Number(split.amount);
        }
      }
    }

    const balanceList: Balance[] = [];
    for (const [id, b] of balances) {
      const info = memberMap.get(id)!;
      balanceList.push({
        member_id: id,
        name: info.name,
        initial: info.initial,
        paid: b.paid,
        owed: b.owed,
        net: Number((b.paid - b.owed).toFixed(4)),
      });
    }

    // Optimize minimal payments using a greedy creditor/debtor match.
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
  });

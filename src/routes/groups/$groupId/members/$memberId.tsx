import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { getGroup } from "@/lib/groups.functions";
import { listMembers } from "@/lib/members.functions";
import { deleteExpense, listExpenses } from "@/lib/expenses.functions";
import { getBalances } from "@/lib/balances.functions";
import { ExpenseList } from "@/components/ExpenseList";
import { toast } from "sonner";

export const Route = createFileRoute("/groups/$groupId/members/$memberId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Member overview — SplitTrip" },
      { name: "description", content: "See what this traveller paid and how they stand in the trip." },
      { property: "og:title", content: "Member overview — SplitTrip" },
      {
        property: "og:description",
        content: "See what this traveller paid and how they stand in the trip.",
      },
    ],
  }),
  component: MemberPage,
});

function MemberPage() {
  const { groupId, memberId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchGroup = useServerFn(getGroup);
  const fetchMembers = useServerFn(listMembers);
  const fetchExpenses = useServerFn(listExpenses);
  const fetchBalances = useServerFn(getBalances);
  const deleteExpenseFn = useServerFn(deleteExpense);

  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroup({ data: { id: groupId } }),
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members", groupId],
    queryFn: () => fetchMembers({ data: { group_id: groupId } }),
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", groupId],
    queryFn: () => fetchExpenses({ data: { group_id: groupId } }),
  });
  const { data: balances } = useQuery({
    queryKey: ["balances", groupId],
    queryFn: () => fetchBalances({ data: { group_id: groupId } }),
  });

  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  const member = members.find((m) => m.id === memberId);
  const memberBalance = balances?.balances.find((b) => b.member_id === memberId);
  const settleCurrency = group?.settle_currency ?? "";
  const paidExpenses = expenses.filter((e) => e.payer_id === memberId);
  const shareAmounts: Record<string, number> = {};
  for (const e of expenses) {
    const split = ((e.expense_splits ?? []) as { member_id: string; amount: number }[]).find(
      (s) => s.member_id === memberId
    );
    if (split) shareAmounts[e.id] = Number(split.amount ?? 0);
  }
  const sharedExpenses = expenses.filter((e) => shareAmounts[e.id] !== undefined);
  const totalPaid = paidExpenses.reduce((sum, e) => sum + Number(e.settle_amount ?? 0), 0);
  const net = memberBalance?.net ?? 0;


  async function handleDeleteExpense(id: string) {
    if (deletingExpenseId) return;
    setDeletingExpenseId(id);
    try {
      await deleteExpenseFn({ data: { id } });
      queryClient.invalidateQueries({ queryKey: ["expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
      toast.success("Expense deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete expense");
    } finally {
      setDeletingExpenseId(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="flex items-center gap-3 px-6 pt-8 pb-4">
        <button
          onClick={() => navigate({ to: "/groups/$groupId", params: { groupId } })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
          {member?.initial || (member?.name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <h1 className="truncate font-display text-3xl font-bold text-foreground">
          {member?.name ?? "Member"}
        </h1>
      </header>

      <main className="flex-1 px-6 pb-12">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Total paid</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">
              {totalPaid.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">{settleCurrency}</p>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Balance</p>
            <p
              className={`mt-1 font-display text-2xl font-bold ${
                net < -0.005 ? "text-destructive" : "text-primary"
              }`}
            >
              {net > 0.005 ? "+" : ""}
              {net.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              {net > 0.005 ? "is owed" : net < -0.005 ? "owes" : "all even"} · {settleCurrency}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-card p-4 text-sm shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Share of expenses</span>
            <span className="font-semibold text-card-foreground">
              {(memberBalance?.owed ?? 0).toFixed(2)} {settleCurrency}
            </span>
          </div>
        </div>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Expenses paid</h2>
          <ExpenseList
            expenses={paidExpenses}
            members={members}
            groupId={groupId}
            settleCurrency={settleCurrency}
            deletingExpenseId={deletingExpenseId}
            onDelete={handleDeleteExpense}
            emptyLabel="No expenses paid by this member."
          />
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Expenses shared in</h2>
          <ExpenseList
            expenses={sharedExpenses}
            members={members}
            groupId={groupId}
            settleCurrency={settleCurrency}
            deletingExpenseId={deletingExpenseId}
            onDelete={handleDeleteExpense}
            shareAmounts={shareAmounts}
            emptyLabel="This member isn't part of any expense split."
          />
        </section>


        <Link
          to="/groups/$groupId/profile"
          params={{ groupId }}
          className="mt-6 block text-center text-sm font-medium text-muted-foreground underline"
        >
          Manage trip members
        </Link>
      </main>
    </div>
  );
}

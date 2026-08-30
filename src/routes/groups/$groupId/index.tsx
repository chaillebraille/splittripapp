import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { getGroup, listGroups } from "@/lib/data/groups";
import { listMembers } from "@/lib/data/members";
import { deleteExpense, listExpenses } from "@/lib/data/expenses";
import { getBalances } from "@/lib/data/balances";
import { ExpenseList } from "@/components/ExpenseList";
import { toast } from "sonner";

export const Route = createFileRoute("/groups/$groupId/")({
  head: () => ({
    meta: [
      { title: "Trip dashboard — SplitTrip" },
      { name: "description", content: "View total spend, recent expenses, and members for this trip." },
      { property: "og:title", content: "Trip dashboard — SplitTrip" },
      {
        property: "og:description",
        content: "View total spend, recent expenses, and members for this trip.",
      },
    ],
  }),
  component: GroupDashboardPage,
});

function GroupDashboardPage() {
  const { groupId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchGroup = getGroup;
  const fetchGroups = listGroups;
  const fetchMembers = listMembers;
  const fetchExpenses = listExpenses;
  const fetchBalances = getBalances;
  const deleteExpenseFn = deleteExpense;

  const { data: groups = [] } = useQuery({ queryKey: ["groups"], queryFn: fetchGroups });
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
  useQuery({
    queryKey: ["balances", groupId],
    queryFn: () => fetchBalances({ data: { group_id: groupId } }),
  });

  const currentGroup = group ?? groups.find((g) => g.id === groupId);

  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.settle_amount ?? 0), 0);

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
        <Link
          to="/"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Link
          to="/groups/$groupId/profile"
          params={{ groupId }}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-base font-bold text-secondary-foreground">
            {currentGroup?.image_url ? (
              <img
                src={currentGroup.image_url}
                alt={`${currentGroup.name} photo`}
                className="h-full w-full object-cover"
              />
            ) : (
              (currentGroup?.name ?? "T").slice(0, 1).toUpperCase()
            )}
          </span>
          <h1 className="truncate font-display text-3xl font-bold text-foreground">
            {currentGroup?.name ?? "Trip"}
          </h1>
        </Link>
      </header>

      <main className="flex-1 px-6 pb-28">
        <Link
          to="/groups/$groupId/settle"
          params={{ groupId }}
          className="block rounded-2xl bg-card p-6 shadow-sm transition-transform active:scale-[0.99]"
        >
          <p className="text-sm font-medium text-muted-foreground">Total expenses</p>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">
            {totalExpense.toFixed(2)} {currentGroup?.settle_currency ?? ""}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {members.length} {members.length === 1 ? "member" : "members"} ·{" "}
            {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
          </p>
        </Link>


        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Members</h2>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => (
              <Link
                key={member.id}
                to="/groups/$groupId/members/$memberId"
                params={{ groupId, memberId: member.id }}
                className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {member.initial || member.name.slice(0, 1).toUpperCase()}
                </span>
                {member.name}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent expenses</h2>
            <Link
              to="/groups/$groupId/expenses/new"
              params={{ groupId }}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Add
            </Link>
          </div>

          <ExpenseList
            expenses={expenses.slice(0, 10)}
            members={members}
            groupId={groupId}
            settleCurrency={currentGroup?.settle_currency}
            deletingExpenseId={deletingExpenseId}
            onDelete={handleDeleteExpense}
          />
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md items-center justify-around px-6 py-3">
          <Link
            to="/"
            className="flex flex-col items-center gap-1 text-sm font-medium text-muted-foreground"
          >
            <Wallet className="h-6 w-6" />
            Trips
          </Link>
          <Link
            to="/groups/$groupId/expenses/new"
            params={{ groupId }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </Link>
          <Link
            to="/groups/$groupId/settle"
            params={{ groupId }}
            className="flex flex-col items-center gap-1 text-sm font-medium text-muted-foreground"
          >
            <Users className="h-6 w-6" />
            Settle
          </Link>
        </div>
      </div>
    </div>
  );
}

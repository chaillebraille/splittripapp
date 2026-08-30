import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Plus, Receipt, Users, Wallet } from "lucide-react";
import { getGroup, listGroups } from "@/lib/groups.functions";
import { listMembers } from "@/lib/members.functions";
import { listExpenses } from "@/lib/expenses.functions";
import { getBalances } from "@/lib/balances.functions";
import { format } from "date-fns";

export const Route = createFileRoute("/groups/$groupId")({
  head: ({ params }) => ({
    meta: [
      { title: "Trip dashboard — SplitTrip" },
      { name: "description", content: "View balances, recent expenses, and members for this trip." },
      { property: "og:title", content: "Trip dashboard — SplitTrip" },
      { property: "og:description", content: "View balances, recent expenses, and members for this trip." },
    ],
  }),
  component: GroupDashboardPage,
});

function GroupDashboardPage() {
  const { groupId } = Route.useParams();
  const fetchGroup = useServerFn(getGroup);
  const fetchMembers = useServerFn(listMembers);
  const fetchExpenses = useServerFn(listExpenses);
  const fetchBalances = useServerFn(getBalances);
  const fetchGroups = useServerFn(listGroups);

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
  const { data: balances } = useQuery({
    queryKey: ["balances", groupId],
    queryFn: () => fetchBalances({ data: { group_id: groupId } }),
  });

  const currentGroup = group ?? groups.find((g) => g.id === groupId);

  const net = balances?.balances.reduce((sum, b) => sum + b.net, 0) ?? 0;
  const isSettled = Math.abs(net) < 0.01;
  const youOwe = (balances?.totalOwes ?? 0) > 0;
  const youAreOwed = (balances?.totalOwed ?? 0) > 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="flex items-center gap-3 px-6 pt-8 pb-4">
        <Link
          to="/"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-bold text-foreground">
            {currentGroup?.name ?? "Trip"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Settle in {currentGroup?.settle_currency ?? "EUR"}
          </p>
        </div>
      </header>

      <main className="flex-1 px-6 pb-28">
        <div className="rounded-2xl bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Group balance</p>
          <div className="mt-2">
            {isSettled ? (
              <span className="font-display text-3xl font-bold text-primary">All even</span>
            ) : youAreOwed ? (
              <span className="font-display text-3xl font-bold text-primary">You are owed</span>
            ) : youOwe ? (
              <span className="font-display text-3xl font-bold text-destructive">You owe</span>
            ) : (
              <span className="font-display text-3xl font-bold text-primary">All even</span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {members.length} {members.length === 1 ? "member" : "members"} ·{" "}
            {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
          </p>
        </div>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Members</h2>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {member.initial || member.name.slice(0, 1).toUpperCase()}
                </span>
                {member.name}
              </div>
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

          {expenses.length === 0 ? (
            <div className="rounded-2xl bg-card p-6 text-center text-muted-foreground shadow-sm">
              <Receipt className="mx-auto mb-2 h-8 w-8" />
              No expenses yet.
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.slice(0, 10).map((expense) => {
                const payer = members.find((m) => m.id === expense.payer_id);
                return (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm"
                  >
                    <div>
                      <p className="font-medium text-card-foreground">{expense.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Paid by {payer?.name ?? "Unknown"} ·{" "}
                        {format(new Date(expense.expense_date), "MMM d")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-card-foreground">
                        {expense.amount} {expense.currency}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ≈ {Number(expense.settle_amount).toFixed(2)} {currentGroup?.settle_currency}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

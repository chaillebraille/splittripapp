import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MoreHorizontal, Plus, Receipt, Trash2, Users, Wallet, X } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { getGroup, listGroups } from "@/lib/groups.functions";
import { createMember, deleteMember, listMembers } from "@/lib/members.functions";
import { deleteExpense, listExpenses } from "@/lib/expenses.functions";
import { getBalances } from "@/lib/balances.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/groups/$groupId")({
  head: () => ({
    meta: [
      { title: "Trip dashboard — SplitTrip" },
      { name: "description", content: "View balances, recent expenses, and members for this trip." },
      { property: "og:title", content: "Trip dashboard — SplitTrip" },
      { property: "og:description", content: "View balances, recent expenses, and members for this trip." },
    ],
  }),
  component: GroupDashboardPage,
});

function initialFromName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    const first = parts[0] ?? "";
    const second = parts[1] ?? "";
    return (first.charAt(0) + second.charAt(0)).toUpperCase();
  }
  return trimmed.slice(0, 1).toUpperCase();
}

function GroupDashboardPage() {
  const { groupId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchGroup = useServerFn(getGroup);
  const fetchGroups = useServerFn(listGroups);
  const fetchMembers = useServerFn(listMembers);
  const fetchExpenses = useServerFn(listExpenses);
  const fetchBalances = useServerFn(getBalances);
  const createMemberFn = useServerFn(createMember);
  const deleteMemberFn = useServerFn(deleteMember);
  const deleteExpenseFn = useServerFn(deleteExpense);

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

  const [newMemberName, setNewMemberName] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  const net = balances?.balances.reduce((sum, b) => sum + b.net, 0) ?? 0;
  const isSettled = Math.abs(net) < 0.01;
  const youOwe = (balances?.totalOwes ?? 0) > 0;
  const youAreOwed = (balances?.totalOwed ?? 0) > 0;

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newMemberName.trim();
    if (!trimmed || isAddingMember) return;
    setIsAddingMember(true);
    try {
      await createMemberFn({
        data: { group_id: groupId, name: trimmed, initial: initialFromName(trimmed) },
      });
      queryClient.invalidateQueries({ queryKey: ["members", groupId] });
      queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
      setNewMemberName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setIsAddingMember(false);
    }
  }

  async function handleDeleteMember(id: string) {
    try {
      await deleteMemberFn({ data: { id } });
      queryClient.invalidateQueries({ queryKey: ["members", groupId] });
      queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

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
                className="group flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {member.initial || member.name.slice(0, 1).toUpperCase()}
                </span>
                {member.name}
                <button
                  type="button"
                  onClick={() => handleDeleteMember(member.id)}
                  className="ml-1 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Remove ${member.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddMember} className="mt-3 flex gap-2">
            <Input
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Add member"
              className="rounded-xl"
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={!newMemberName.trim() || isAddingMember}
              className="shrink-0 rounded-xl"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </form>
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
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-card-foreground">{expense.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Paid by {payer?.name ?? "Unknown"} ·{" "}
                        {format(new Date(expense.expense_date), "MMM d")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="font-semibold text-card-foreground">
                          {expense.amount} {expense.currency}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ≈ {Number(expense.settle_amount).toFixed(2)} {currentGroup?.settle_currency}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Link
                          to="/groups/$groupId/expenses/$expenseId/edit"
                          params={{ groupId, expenseId: expense.id }}
                          className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
                          aria-label="Edit expense"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(expense.id)}
                          disabled={deletingExpenseId === expense.id}
                          className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Delete expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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

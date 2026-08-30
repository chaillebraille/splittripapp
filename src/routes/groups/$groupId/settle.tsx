import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRightLeft, Wallet } from "lucide-react";
import { getGroup } from "@/lib/groups.functions";
import { listMembers } from "@/lib/members.functions";
import { getBalances } from "@/lib/balances.functions";

export const Route = createFileRoute("/groups/$groupId/settle")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settle up — SplitTrip" },
      { name: "description", content: "See who owes what and the minimal payments to settle the trip." },
      { property: "og:title", content: "Settle up — SplitTrip" },
      { property: "og:description", content: "See who owes what and the minimal payments to settle the trip." },
    ],
  }),
  component: SettlePage,
});

function SettlePage() {
  const { groupId } = Route.useParams();
  const fetchGroup = useServerFn(getGroup);
  const fetchMembers = useServerFn(listMembers);
  const fetchBalances = useServerFn(getBalances);

  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroup({ data: { id: groupId } }),
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members", groupId],
    queryFn: () => fetchMembers({ data: { group_id: groupId } }),
  });
  const { data: balances } = useQuery({
    queryKey: ["balances", groupId],
    queryFn: () => fetchBalances({ data: { group_id: groupId } }),
  });

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const totalSpent = balances?.balances.reduce((sum, b) => sum + b.paid, 0) ?? 0;
  const payments = balances?.suggestions ?? [];

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="flex items-center gap-3 px-6 pt-8 pb-4">
        <Link
          to="/groups/$groupId"
          params={{ groupId }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-3xl font-bold text-foreground">Settle up</h1>
      </header>

      <main className="flex-1 px-6 pb-28">
        <div className="rounded-2xl bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Trip total</p>
          <p className="font-display text-3xl font-bold text-card-foreground">
            {totalSpent.toFixed(2)} {group?.settle_currency ?? "EUR"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {payments.length === 0
              ? "All even — no payments needed"
              : `${payments.length} payment${payments.length === 1 ? "" : "s"} suggested`}
          </p>
        </div>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Member balances</h2>
          <div className="space-y-3">
            {balances?.balances.map((b) => {
              const m = memberMap.get(b.member_id);
              const positive = b.net > 0;
              return (
                <Link
                  key={b.member_id}
                  to="/groups/$groupId/members/$memberId"
                  params={{ groupId, memberId: b.member_id }}
                  className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                      {m?.initial || m?.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="font-medium text-card-foreground">{m?.name}</span>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        positive ? "text-primary" : b.net < 0 ? "text-destructive" : "text-card-foreground"
                      }`}
                    >
                      {positive ? "+" : ""}
                      {b.net.toFixed(2)} {group?.settle_currency ?? "EUR"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {positive ? "is owed" : b.net < 0 ? "owes" : "settled"}
                    </p>
                  </div>
                </Link>

              );
            })}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Minimal payments</h2>
          {payments.length === 0 ? (
            <div className="rounded-2xl bg-card p-6 text-center text-muted-foreground shadow-sm">
              <Wallet className="mx-auto mb-2 h-8 w-8" />
              Everyone is even.
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                      <ArrowRightLeft className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-card-foreground">
                        {p.from.name} pays {p.to.name}
                      </p>
                      <p className="text-xs text-muted-foreground">to settle the balance</p>
                    </div>
                  </div>
                  <p className="font-semibold text-card-foreground">
                    {p.amount.toFixed(2)} {group?.settle_currency ?? "EUR"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

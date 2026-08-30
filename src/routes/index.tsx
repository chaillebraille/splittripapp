import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users, Wallet } from "lucide-react";
import { listGroups } from "@/lib/groups.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "SplitTrip — Your trips" },
      { name: "description", content: "Pick a trip to view balances and expenses, or create a new one." },
      { property: "og:title", content: "SplitTrip — Your trips" },
      { property: "og:description", content: "Pick a trip to view balances and expenses, or create a new one." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const fetchGroups = useServerFn(listGroups);
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="px-6 pt-8 pb-4">
        <h1 className="font-display text-4xl font-bold text-foreground">SplitTrip</h1>
      </header>

      <main className="flex-1 px-6 pb-24">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading trips…</div>
        ) : groups.length === 0 ? (
          <div className="mt-12 rounded-2xl bg-card p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Wallet className="h-8 w-8 text-secondary-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-card-foreground">No trips yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first trip to start splitting costs with friends.
            </p>
            <Link
              to="/groups/new"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create a trip
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Link
                key={group.id}
                to="/groups/$groupId"
                params={{ groupId: group.id }}
                className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm transition-transform active:scale-[0.98]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-bold text-secondary-foreground">
                  {group.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-card-foreground">{group.name}</h3>
                  <p className="text-sm text-muted-foreground">Settle in {group.settle_currency}</p>
                </div>
                <Users className="h-5 w-5 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-3">
          <Link
            to="/"
            className="flex flex-col items-center gap-1 text-sm font-medium text-primary"
          >
            <Wallet className="h-6 w-6" />
            Trips
          </Link>
          <Link
            to="/groups/new"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </Link>
          <span className="flex flex-col items-center gap-1 text-sm font-medium text-muted-foreground">
            <Users className="h-6 w-6" />
            More
          </span>
        </div>
      </div>
    </div>
  );
}

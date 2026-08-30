import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Plus, ShieldCheck, Users, Wallet } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listGroups } from "@/lib/data/groups";
import { useAuth } from "@/lib/auth-provider";

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
  const navigate = useNavigate();
  const { displayName, isAdmin, signOut } = useAuth();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const fetchGroups = listGroups;
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
  });

  async function handleSignOut() {
    await signOut();
    void navigate({ to: "/auth", search: { redirect: "/" }, replace: true });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="flex items-center justify-between gap-3 px-6 pt-8 pb-4">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-bold text-foreground">SplitTrip</h1>
          {displayName && (
            <p className="truncate text-xs text-muted-foreground">{displayName}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {isAdmin && (
            <Link
              to="/admin"
              aria-label="Manage users"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
            >
              <ShieldCheck className="h-5 w-5" />
            </Link>
          )}
          <button
            onClick={() => setSignOutOpen(true)}
            aria-label="Sign out"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need to sign in again to see your trips on this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleSignOut()}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-lg font-bold text-secondary-foreground">
                  {group.image_url ? (
                    <img
                      src={group.image_url}
                      alt={`${group.name} photo`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    group.name.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-card-foreground">{group.name}</h3>
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

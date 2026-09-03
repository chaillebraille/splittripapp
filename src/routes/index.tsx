import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { syncNow } from "@/lib/local/sync";
import { Plus, ShieldCheck, User, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listGroups } from "@/lib/data/groups";
import { useAuth } from "@/lib/auth-provider";
import { APP_VERSION, applyAppUpdate, fetchPublishedVersion } from "@/lib/version";

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
  const { displayName, isAdmin } = useAuth();
  const [versionOpen, setVersionOpen] = useState(false);
  const [latestVersion, setLatestVersion] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const fetchGroups = listGroups;
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
  });

  // The SSR pass always runs the server's current code, so reading APP_VERSION
  // during render can report a newer number than the bundle actually installed
  // on the device. Read it after hydration, from the running client bundle.
  const [installedVersion, setInstalledVersion] = useState<number | null>(null);
  useEffect(() => {
    setInstalledVersion(APP_VERSION);
  }, []);

  const queryClient = useQueryClient();

  async function openVersionDialog() {
    setVersionOpen(true);
    setChecking(true);
    // Opening this dialog is a sync event: sync pending changes first
    // (offline edits must reach the server), then fetch the latest version.
    const changed = await syncNow();
    if (changed) queryClient.invalidateQueries();
    const published = await fetchPublishedVersion();
    setLatestVersion(published);
    setChecking(false);
  }

  const updateAvailable =
    latestVersion !== null && installedVersion !== null && latestVersion > installedVersion;


  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="flex items-center justify-between gap-3 px-6 pt-8 pb-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => void openVersionDialog()}
            className="text-left font-display text-4xl font-bold text-foreground"
          >
            SplitTrip
          </button>
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
          <Link
            to="/profile"
            aria-label="Your profile"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          >
            <User className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SplitTrip</DialogTitle>
            <DialogDescription>App version information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 text-sm">
            <p className="text-foreground">
              Installed version: <span className="font-semibold">{installedVersion ?? "…"}</span>
            </p>
            <p className="text-muted-foreground">
              {checking
                ? "Checking for updates…"
                : latestVersion === null
                  ? "Latest version unavailable (offline)."
                  : `Latest published version: ${latestVersion}`}
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => void applyAppUpdate()}
              disabled={!updateAvailable}
              className="w-full rounded-xl"
            >
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


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
              </Link>
            ))}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto grid max-w-md grid-cols-3 items-center px-6 py-3">
          <div />
          <Link
            to="/groups/new"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </Link>
          <div />
        </div>
      </div>
    </div>
  );
}

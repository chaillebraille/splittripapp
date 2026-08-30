import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, KeyRound, Plus, ShieldCheck, Trash2, UserX, UserCheck } from "lucide-react";
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
import { useAuth } from "@/lib/auth-provider";
import {
  adminCreateUser,
  adminDeleteUser,
  adminResetPassword,
  adminSetUserDisabled,
  listUsers,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "User admin — SplitTrip" },
      { name: "description", content: "Manage SplitTrip user accounts." },
      { property: "og:title", content: "User admin — SplitTrip" },
      { property: "og:description", content: "Manage SplitTrip user accounts." },
    ],
  }),
  component: AdminPage,
});

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isReady, isAdmin, userId } = useAuth();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers(),
    enabled: isReady && isAdmin,
  });

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const sortedUsers = [...users].sort((a, b) =>
    a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }),
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (isBusy) return;
    setIsBusy(true);
    const password = generatePassword();
    try {
      await adminCreateUser({
        data: { email: email.trim(), password, displayName: displayName.trim() || email.trim() },
      });
      toast.success(`Account created. Password: ${password}`, { duration: 20000 });
      setEmail("");
      setDisplayName("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the user");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteUser(targetId: string, label: string) {
    try {
      const result = await adminDeleteUser({ data: { userId: targetId } });
      if (!result.success) {
        toast.error(result.error ?? "Could not delete the account");
        return;
      }
      toast.success(`${label} deleted`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the account");
    }
  }

  async function handleResetPassword(userId: string, userEmail: string) {
    const password = generatePassword();
    try {
      await adminResetPassword({ data: { userId, password } });
      toast.success(`New password for ${userEmail}: ${password}`, { duration: 20000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset the password");
    }
  }

  async function handleToggleDisabled(targetId: string, disabled: boolean) {
    try {
      const result = await adminSetUserDisabled({
        data: { userId: targetId, disabled: !disabled },
      });
      if (!result.success) {
        toast.error(result.error ?? "Could not update the account");
        return;
      }
      toast.success(!disabled ? "Account disabled" : "Account re-enabled");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the account");
    }
  }

  if (isReady && !isAdmin) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">Admins only</h1>
        <p className="text-sm text-muted-foreground">This page manages user accounts.</p>
        <Button
          onClick={() => navigate({ to: "/" })}
          className="rounded-xl bg-primary px-6 text-primary-foreground"
        >
          Back to my trips
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="flex items-center gap-3 px-6 pt-8 pb-4">
        <button
          onClick={() => navigate({ to: "/" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-3xl font-bold text-foreground">Users</h1>
      </header>

      <main className="flex-1 space-y-6 px-6 pb-12">
        <form onSubmit={handleCreate} className="space-y-3 rounded-2xl bg-card p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">New user</h2>
          <div className="space-y-2">
            <Label htmlFor="new-name">Name</Label>
            <Input
              id="new-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              className="rounded-xl"
            />
          </div>
          <Button
            type="submit"
            disabled={isBusy || !email.trim()}
            className="w-full rounded-xl bg-primary text-primary-foreground"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create account
          </Button>
          <p className="text-xs text-muted-foreground">
            A password is generated and shown to you once — pass it on to the user.
          </p>
        </form>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">All users</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            sortedUsers.map((user) => (
              <div key={user.id} className="rounded-2xl bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-card-foreground">
                      {user.display_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.is_admin ? "Admin" : "Member"} · {user.disabled ? "Disabled" : "Active"}
                      {user.last_sign_in_at
                        ? ` · last seen ${new Date(user.last_sign_in_at).toLocaleDateString()}`
                        : " · never signed in"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {user.is_admin && <ShieldCheck className="h-5 w-5 text-primary" />}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Reset password for ${user.display_name}`}
                      onClick={() => setResetTarget({ id: user.id, label: user.display_name })}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    {user.id !== userId && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={
                            user.disabled
                              ? `Re-enable ${user.display_name}`
                              : `Disable ${user.display_name}`
                          }
                          onClick={() => void handleToggleDisabled(user.id, user.disabled)}
                        >
                          {user.disabled ? (
                            <UserCheck className="h-4 w-4" />
                          ) : (
                            <UserX className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${user.display_name}`}
                          onClick={() => setDeleteTarget({ id: user.id, label: user.display_name })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      <AlertDialog
        open={resetTarget !== null}
        onOpenChange={(open) => !open && setResetTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create a new password?</AlertDialogTitle>
            <AlertDialogDescription>
              {resetTarget?.label}'s current password stops working immediately. The new password is
              shown to you once — pass it on.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (resetTarget) void handleResetPassword(resetTarget.id, resetTarget.label);
                setResetTarget(null);
              }}
            >
              Create password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the account and every trip it owns, including those trips'
              members and expenses. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) void handleDeleteUser(deleteTarget.id, deleteTarget.label);
                setDeleteTarget(null);
              }}
            >
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

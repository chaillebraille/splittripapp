import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, KeyRound, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-provider";
import {
  adminDeleteUser,
  adminResetPassword,
  adminSetUserDisabled,
  adminSetUserRole,
  listUsers,
} from "@/lib/admin.functions";
import { generatePassword, validatePassword } from "@/lib/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/$userId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Edit user — SplitTrip" },
      { name: "description", content: "Edit a SplitTrip user account." },
      { property: "og:title", content: "Edit user — SplitTrip" },
      { property: "og:description", content: "Edit a SplitTrip user account." },
    ],
  }),
  component: AdminUserPage,
});

function AdminUserPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId: currentUserId, isReady, isAdmin } = useAuth();
  const { userId } = Route.useParams();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers(),
    enabled: isReady && isAdmin,
  });

  const user = users.find((u) => u.id === userId);
  const isSelf = currentUserId === userId;

  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function handleRole(makeAdmin: boolean) {
    setBusy(true);
    try {
      const result = await adminSetUserRole({ data: { userId, makeAdmin } });
      if (!result.success) {
        toast.error(result.error ?? "Could not update the role");
        return;
      }
      toast.success(makeAdmin ? "User is now an admin" : "Admin rights revoked");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the role");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisabled(disabled: boolean) {
    setBusy(true);
    try {
      const result = await adminSetUserDisabled({ data: { userId, disabled } });
      if (!result.success) {
        toast.error(result.error ?? "Could not update the account");
        return;
      }
      toast.success(disabled ? "Account disabled" : "Account re-enabled");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the account");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    try {
      const result = await adminDeleteUser({ data: { userId } });
      if (!result.success) {
        toast.error(result.error ?? "Could not delete the account");
        return;
      }
      toast.success(`${user?.username ?? "Account"} deleted`);
      await refresh();
      void navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the account");
    }
  }

  async function handleResetPassword(password: string) {
    try {
      await adminResetPassword({ data: { userId, password } });
      toast.success(`New password created for ${user?.username ?? "the user"}.`, {
        duration: 20000,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset the password");
    }
  }

  if (isReady && !isAdmin) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">Admins only</h1>
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
          onClick={() => navigate({ to: "/admin" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          aria-label="Back to users"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex min-w-0 items-center gap-1.5 font-display text-3xl font-bold text-foreground">
          <span className="truncate">{user?.username ?? "User"}</span>
          {user?.is_admin && <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />}
        </h1>
      </header>

      <main className="flex-1 space-y-4 px-6 pb-12">
        {isLoading && !user ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !user ? (
          <p className="text-sm text-muted-foreground">This account no longer exists.</p>
        ) : (
          <>
            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">
                {user.disabled ? "Disabled" : "Active"}
                {user.last_sign_in_at
                  ? ` · last seen ${new Date(user.last_sign_in_at).toLocaleDateString()}`
                  : " · never signed in"}
              </p>
            </div>

            <div className="space-y-4 rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Label htmlFor="role-switch">Administrator</Label>
                  <p className="text-xs text-muted-foreground">
                    {isSelf
                      ? "You can't revoke your own admin rights."
                      : "Admins manage all user accounts."}
                  </p>
                </div>
                <Switch
                  id="role-switch"
                  checked={user.is_admin}
                  disabled={busy || (isSelf && user.is_admin)}
                  onCheckedChange={(checked) => void handleRole(checked)}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Label htmlFor="active-switch">Account active</Label>
                  <p className="text-xs text-muted-foreground">
                    {isSelf
                      ? "You can't disable your own account."
                      : "Disabled accounts can't sign in."}
                  </p>
                </div>
                <Switch
                  id="active-switch"
                  checked={!user.disabled}
                  disabled={busy || isSelf}
                  onCheckedChange={(checked) => void handleDisabled(!checked)}
                />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => {
                setResetPassword(generatePassword());
                setResetOpen(true);
              }}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              Change password
            </Button>

            {!isSelf && (
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete user
              </Button>
            )}
          </>
        )}
      </main>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create a new password?</AlertDialogTitle>
            <AlertDialogDescription>
              {user?.username}'s current password stops working immediately. The new password is
              shown to you once — pass it on.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reset-password">New password</Label>
            <div className="flex gap-2">
              <Input
                id="reset-password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="rounded-xl font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Generate another password"
                className="shrink-0 rounded-xl"
                onClick={() => setResetPassword(generatePassword())}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                const pwError = validatePassword(resetPassword);
                if (pwError) {
                  e.preventDefault();
                  toast.error(pwError);
                  return;
                }
                void handleResetPassword(resetPassword);
                setResetOpen(false);
              }}
            >
              Create password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {user?.username}?</AlertDialogTitle>
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
                setDeleteOpen(false);
                void handleDelete();
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

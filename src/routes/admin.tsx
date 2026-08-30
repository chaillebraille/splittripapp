import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  Share2,
  ShieldCheck,
  Trash2,
  UserX,
  UserCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-provider";
import {
  adminCreateUser,
  adminDeleteUser,
  adminResetPassword,
  adminSetUserDisabled,
  listUsers,
} from "@/lib/admin.functions";
import { generatePassword, validatePassword } from "@/lib/password";
import { validateUsername } from "@/lib/username";
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

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isReady, isAdmin, userId } = useAuth();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers(),
    enabled: isReady && isAdmin,
  });

  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState(() => generatePassword());
  const [isBusy, setIsBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: string; label: string } | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [shareTarget, setShareTarget] = useState<string | null>(null);
  const [shareQr, setShareQr] = useState<string | null>(null);
  const shareUrl = `${window.location.origin}/auth`;

  useEffect(() => {
    if (shareTarget === null) {
      setShareQr(null);
      return;
    }
    let cancelled = false;
    void import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(shareUrl, { width: 320, margin: 2 }),
      )
      .then((url) => {
        if (!cancelled) setShareQr(url);
      });
    return () => {
      cancelled = true;
    };
  }, [shareTarget, shareUrl]);

  async function handleCopyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied — send it to the user");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  const sortedUsers = [...users].sort((a, b) =>
    (a?.username ?? "").localeCompare(b?.username ?? "", undefined, { sensitivity: "base" }),
  );


  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (isBusy) return;
    const nameError = validateUsername(username);
    if (nameError) {
      toast.error(nameError);
      return;
    }
    const pwError = validatePassword(newPassword);
    if (pwError) {
      toast.error(pwError);
      return;
    }
    setIsBusy(true);
    try {
      await adminCreateUser({ data: { username: username.trim(), password: newPassword } });
      toast.success(`Account created. Password: ${newPassword}`, { duration: 20000 });
      setUsername("");
      setNewPassword(generatePassword());
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

  async function handleResetPassword(targetId: string, label: string, password: string) {
    try {
      await adminResetPassword({ data: { userId: targetId, password } });
      toast.success(`New password for ${label}: ${password}`, { duration: 20000 });
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
            <Label htmlFor="new-username">Username</Label>
            <Input
              id="new-username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s+/gu, ""))}
              placeholder="e.g. alex.k"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              One word — letters, digits, period, underscore or hyphen. No spaces.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Password</Label>
            <div className="flex gap-2">
              <Input
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
                onClick={() => setNewPassword(generatePassword())}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Suggested password — you can replace it (min. 12 characters, mixed types).
            </p>
          </div>
          <Button
            type="submit"
            disabled={isBusy || !username.trim()}
            className="w-full rounded-xl bg-primary text-primary-foreground"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create account
          </Button>
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
                    <p className="truncate font-medium text-card-foreground">{user.username}</p>
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
                      aria-label={`Reset password for ${user.username}`}
                      onClick={() => {
                        setResetPassword(generatePassword());
                        setResetTarget({ id: user.id, label: user.username });
                      }}
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
                              ? `Re-enable ${user.username}`
                              : `Disable ${user.username}`
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
                          aria-label={`Delete ${user.username}`}
                          onClick={() => setDeleteTarget({ id: user.id, label: user.username })}
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
                if (resetTarget)
                  void handleResetPassword(resetTarget.id, resetTarget.label, resetPassword);
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

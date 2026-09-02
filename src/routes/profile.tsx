import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { generatePassword, validatePassword } from "@/lib/password";
import { loadMemberName, readCachedMemberName, saveMemberName } from "@/lib/data/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your profile — SplitTrip" },
      { name: "description", content: "Your username, default member name and sign-out." },
      { property: "og:title", content: "Your profile — SplitTrip" },
      { property: "og:description", content: "Your username, default member name and sign-out." },
    ],
  }),
  component: UserProfilePage,
});

function UserProfilePage() {
  const navigate = useNavigate();
  const { userId, displayName, isAdmin, signOut } = useAuth();
  const [memberName, setMemberName] = useState(() => readCachedMemberName(userId) ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  function openPasswordDialog(open: boolean) {
    setPwOpen(open);
    if (open) {
      setNewPassword(generatePassword());
    }
  }

  async function handleChangePassword() {
    const pwError = validatePassword(newPassword);
    if (pwError) {
      toast.error(pwError);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
      return;
    }
    setPwOpen(false);
    toast.success("New password created.", { duration: 20000 });
  }


  useEffect(() => {
    let cancelled = false;
    void loadMemberName(userId, displayName).then((name) => {
      if (!cancelled && name) setMemberName(name);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, displayName]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving || !memberName.trim()) return;
    setIsSaving(true);
    try {
      await saveMemberName(userId, memberName);
      toast.success("Profile saved");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the profile");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    void navigate({ to: "/auth", search: { redirect: "/" }, replace: true });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="flex items-center justify-between gap-3 px-6 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/" })}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-3xl font-bold text-foreground">Profile</h1>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              aria-label="Sign out"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </AlertDialogTrigger>
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
      </header>

      <form onSubmit={handleSave} className="flex-1 space-y-6 px-6 pb-24">
        <div className="space-y-2">
          <Label>Username</Label>
          <p className="rounded-xl bg-secondary px-4 py-3 font-medium text-secondary-foreground">
            {displayName ?? "—"}
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ShieldCheck className="h-5 w-5 text-green-500" aria-label="Admin" />
            You are an administrator
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="member-name">Member name</Label>
          <Input
            id="member-name"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="Name shown in trips"
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            New trips start with this member already added.
          </p>
        </div>

        <AlertDialog open={pwOpen} onOpenChange={openPasswordDialog}>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" className="w-full rounded-xl py-6 text-base">
              <KeyRound className="mr-2 h-4 w-4" />
              Change password
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Create a new password?</AlertDialogTitle>
              <AlertDialogDescription>
                Your current password stops working immediately. The new password is shown to you
                once — write it down.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-new-password">New password</Label>
                <div className="flex gap-2">
                  <Input
                    id="profile-new-password"
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
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleChangePassword();
                }}
              >
                Create new password
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          type="submit"
          disabled={!memberName.trim() || isSaving}
          className="w-full rounded-xl bg-primary py-6 text-base font-semibold text-primary-foreground"
        >
          Save profile
        </Button>
      </form>

    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { bootstrapAdmin, getSetupStatus } from "@/lib/admin.functions";
import { usernameToEmail, validateUsername } from "@/lib/username";
import { generatePassword, validatePassword } from "@/lib/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";


export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: z.object({ redirect: z.string().optional() }).parse,
  head: () => ({
    meta: [
      { title: "Sign in — SplitTrip" },
      { name: "description", content: "Sign in to your SplitTrip account." },
      { property: "og:title", content: "Sign in — SplitTrip" },
      { property: "og:description", content: "Sign in to your SplitTrip account." },
    ],
  }),
  component: AuthPage,
});

function safeRedirect(target: string | undefined): string {
  if (target && target.startsWith("/") && !target.startsWith("//")) return target;
  return "/";
}

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { isReady, userId } = useAuth();
  const destination = safeRedirect(redirect);

  const { data: setup, isLoading: setupLoading } = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => getSetupStatus(),
  });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const needsSetup = setup?.needsSetup ?? false;

  useEffect(() => {
    if (isReady && userId) {
      void navigate({ to: destination, replace: true });
    }
  }, [isReady, userId, destination, navigate]);

  // Suggest a strong password when creating the very first admin account.
  useEffect(() => {
    if (needsSetup && !password) setPassword(generatePassword());
  }, [needsSetup, password]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (isBusy) return;
    setIsBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    setIsBusy(false);
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Wrong username or password"
          : error.message,
      );
    }
    // On success the auth listener flips userId and the effect navigates.
  }

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault();
    if (isBusy) return;
    const nameError = validateUsername(username);
    if (nameError) {
      toast.error(nameError);
      return;
    }
    const pwError = validatePassword(password);
    if (pwError) {
      toast.error(pwError);
      return;
    }
    setIsBusy(true);
    try {
      await bootstrapAdmin({ data: { username: username.trim(), password } });
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password,
      });
      if (error) throw error;
      toast.success("Admin account created — welcome!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the account");
      setIsBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-background px-6 pb-16">
      <div className="mb-10 text-center">
        <h1 className="font-display text-5xl font-bold text-foreground">SplitTrip</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {needsSetup ? "Create the first admin account" : "Sign in to continue"}
        </p>
      </div>

      <form
        onSubmit={needsSetup ? handleBootstrap : handleSignIn}
        className="space-y-4 rounded-2xl bg-card p-6 shadow-sm"
      >
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s+/gu, ""))}
            placeholder="e.g. alex.k"
            className="rounded-xl"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
          />
          {needsSetup && (
            <p className="text-xs text-muted-foreground">
              One word — letters, digits, period, underscore or hyphen. No spaces.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={needsSetup || showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={needsSetup ? "At least 12 characters" : "Your password"}
              className={needsSetup ? "rounded-xl pr-11 font-mono" : "rounded-xl pr-11"}
              autoComplete={needsSetup ? "new-password" : "current-password"}
            />
            {!needsSetup && (
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
          </div>
          {needsSetup && (
            <p className="text-xs text-muted-foreground">
              Suggested password — you can replace it. Write it down.
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isBusy || setupLoading}
          className="w-full rounded-xl bg-primary py-6 text-base font-semibold text-primary-foreground"
        >
          {needsSetup ? "Create admin account" : "Sign in"}
        </Button>
        {!needsSetup && (
          <p className="text-center text-xs text-muted-foreground">
            No account? Ask the app owner to create one for you.
          </p>
        )}
      </form>
    </div>
  );

}

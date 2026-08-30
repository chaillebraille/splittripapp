import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { bootstrapAdmin, getSetupStatus } from "@/lib/admin.functions";
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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (isReady && userId) {
      void navigate({ to: destination, replace: true });
    }
  }, [isReady, userId, destination, navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (isBusy) return;
    setIsBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsBusy(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Wrong email or password" : error.message);
    }
    // On success the auth listener flips userId and the effect navigates.
  }

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault();
    if (isBusy) return;
    setIsBusy(true);
    try {
      await bootstrapAdmin({
        data: { email: email.trim(), password, displayName: displayName.trim() || email.trim() },
      });
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      toast.success("Admin account created — welcome!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the account");
      setIsBusy(false);
    }
  }

  const needsSetup = setup?.needsSetup ?? false;

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
        {needsSetup && (
          <div className="space-y-2">
            <Label htmlFor="displayName">Your name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex"
              className="rounded-xl"
              autoComplete="name"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-xl"
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={needsSetup ? "At least 8 characters" : "Your password"}
            className="rounded-xl"
            autoComplete={needsSetup ? "new-password" : "current-password"}
          />
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

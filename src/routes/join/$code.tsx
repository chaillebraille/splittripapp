import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { redeemInvite } from "@/lib/sharing.functions";
import { syncNow } from "@/lib/local/sync";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/join/$code")({
  loader: ({ params }) => getInvitePreview({ data: { code: params.code } }),
  head: ({ loaderData }) => {
    const name = loaderData?.name;
    const title = name
      ? `${loaderData?.role === "viewer" ? "View" : "Join"} ${name} — SplitTrip`
      : "Join a trip — SplitTrip";
    const description = name
      ? `You've been invited to ${loaderData?.role === "viewer" ? "view" : "join"} the trip "${name}" in SplitTrip.`
      : "Accept a shared trip invitation.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  errorComponent: () => (
    <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6 text-center text-muted-foreground">
      This invite link could not be opened.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6 text-center text-muted-foreground">
      This invite link is no longer valid.
    </div>
  ),
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const { groupId } = await redeemInvite({ data: { code } });
        // Pull the freshly shared trip down so it appears offline too.
        await syncNow();
        await queryClient.invalidateQueries();
        toast.success("You've joined the trip");
        void navigate({ to: "/groups/$groupId", params: { groupId }, replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not join this trip");
      }
    })();
  }, [code, navigate, queryClient]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      {error ? (
        <>
          <h1 className="font-display text-2xl font-bold text-foreground">Invite not valid</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button
            onClick={() => navigate({ to: "/", replace: true })}
            className="rounded-xl bg-primary px-6 text-primary-foreground"
          >
            Go to my trips
          </Button>
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl font-bold text-foreground">Joining trip…</h1>
          <p className="text-sm text-muted-foreground">Hold on while we add the trip to your app.</p>
        </>
      )}
    </div>
  );
}

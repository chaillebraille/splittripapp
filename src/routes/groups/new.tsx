import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { loadMemberName, readCachedMemberName } from "@/lib/data/profile";
import { ArrowLeft, Plus, X } from "lucide-react";
import { createGroup } from "@/lib/data/groups";
import { createMember, suggestMembers } from "@/lib/data/members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TripImagePicker } from "@/components/TripImagePicker";
import { CurrencyPicker } from "@/components/CurrencyPicker";

export const Route = createFileRoute("/groups/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "New trip — SplitTrip" },
      { name: "description", content: "Create a new trip and choose a settle currency." },
      { property: "og:title", content: "New trip — SplitTrip" },
      { property: "og:description", content: "Create a new trip and choose a settle currency." },
    ],
  }),
  component: NewGroupPage,
});


function initialFromName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    const first = parts[0] ?? "";
    const second = parts[1] ?? "";
    return (first.charAt(0) + second.charAt(0)).toUpperCase();
  }
  return trimmed.slice(0, 1).toUpperCase();
}

function NewGroupPage() {
  const navigate = useNavigate();
  const { userId, displayName } = useAuth();
  const createGroupFn = createGroup;
  const createMemberFn = createMember;
  const fetchSuggestions = suggestMembers;

  const { data: suggestions = [] } = useQuery({
    queryKey: ["member-suggestions"],
    queryFn: fetchSuggestions,
  });

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [members, setMembers] = useState<{ name: string; initial: string }[]>(() => {
    const cached = readCachedMemberName(userId);
    return cached ? [{ name: cached, initial: initialFromName(cached) }] : [];
  });
  const [newMemberName, setNewMemberName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // A new trip always starts with the signed-in user's own member.
  useEffect(() => {
    let cancelled = false;
    void loadMemberName(userId, displayName).then((own) => {
      if (cancelled || !own.trim()) return;
      setMembers((prev) =>
        prev.some((m) => m.name.toLowerCase() === own.trim().toLowerCase())
          ? prev
          : [{ name: own.trim(), initial: initialFromName(own) }, ...prev],
      );
    });
    return () => {
      cancelled = true;
    };
  }, [userId, displayName]);

  function addMember(name: string, initial?: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) return;
    setMembers((prev) => [...prev, { name: trimmed, initial: initial?.toUpperCase() || initialFromName(trimmed) }]);
  }

  function removeMember(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const group = await createGroupFn({
        data: { name: name.trim(), settle_currency: currency, image_url: imageUrl },
      });
      for (const member of members) {
        await createMemberFn({ data: { group_id: group.id, name: member.name, initial: member.initial } });
      }
      navigate({ to: "/groups/$groupId", params: { groupId: group.id } });
    } finally {
      setIsSubmitting(false);
    }
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
        <h1 className="font-display text-3xl font-bold text-foreground">New trip</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 px-6 pb-28">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Trip photo</Label>
            <TripImagePicker
              value={imageUrl}
              onChange={setImageUrl}
              fallback={name.trim().slice(0, 1).toUpperCase()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Trip name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer in Italy"
              className="rounded-xl"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Settle currency</Label>
            <CurrencyPicker id="currency" value={currency} onChange={setCurrency} className="py-2.5" title="Settle currency" />
            <p className="text-xs text-muted-foreground">
              All expenses will be converted to this currency for balances.
            </p>
          </div>

          <div className="space-y-3">
            <Label>Members</Label>
            {members.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {members.map((member, index) => (
                  <div
                    key={member.name}
                    className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {member.initial}
                    </span>
                    {member.name}
                    <button
                      type="button"
                      onClick={() => removeMember(index)}
                      className="ml-1 rounded-full p-0.5 hover:bg-secondary-foreground/10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addMember(newMemberName);
                    setNewMemberName("");
                  }
                }}
                placeholder="Add a member"
                className="rounded-xl"
              />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                addMember(newMemberName);
                setNewMemberName("");
              }}
              aria-label="Add member"
              className="shrink-0 rounded-xl"
            >
              <Plus className="h-4 w-4" />
            </Button>
            </div>

            {suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Suggested from previous trips</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => addMember(s.name, s.initial)}
                      className="rounded-full border border-input bg-card px-3 py-1.5 text-sm font-medium text-card-foreground transition-colors hover:bg-accent"
                    >
                      + {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/95 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-md">
            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="w-full rounded-xl bg-primary py-6 text-base font-semibold text-primary-foreground"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create trip
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

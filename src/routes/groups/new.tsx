import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createGroup } from "@/lib/groups.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/groups/new")({
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

const COMMON_CURRENCIES = ["EUR", "USD", "GBP", "SEK", "NOK", "DKK", "CHF", "PLN"];

function NewGroupPage() {
  const navigate = useNavigate();
  const create = useServerFn(createGroup);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const group = await create({ data: { name: name.trim(), settle_currency: currency } });
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

      <form onSubmit={handleSubmit} className="flex-1 px-6 pb-24">
        <div className="space-y-6">
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
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              All expenses will be converted to this currency for balances.
            </p>
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

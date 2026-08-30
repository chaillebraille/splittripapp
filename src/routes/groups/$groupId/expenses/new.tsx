import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { getGroup } from "@/lib/groups.functions";
import { listMembers, suggestMembers } from "@/lib/members.functions";
import { createExpense } from "@/lib/expenses.functions";
import { getExchangeRate } from "@/lib/exchange-rate.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/groups/$groupId/expenses/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Add expense — SplitTrip" },
      { name: "description", content: "Add a new expense to this trip." },
      { property: "og:title", content: "Add expense — SplitTrip" },
      { property: "og:description", content: "Add a new expense to this trip." },
    ],
  }),
  component: NewExpensePage,
});

const COMMON_CURRENCIES = ["EUR", "USD", "GBP", "SEK", "NOK", "DKK", "CHF", "PLN"];

function NewExpensePage() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchGroup = useServerFn(getGroup);
  const fetchMembers = useServerFn(listMembers);
  const fetchRate = useServerFn(getExchangeRate);
  const create = useServerFn(createExpense);

  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroup({ data: { id: groupId } }),
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members", groupId],
    queryFn: () => fetchMembers({ data: { group_id: groupId } }),
  });

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(group?.settle_currency ?? "EUR");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [payerId, setPayerId] = useState<string>("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (group?.settle_currency && !currency) {
      setCurrency(group.settle_currency);
    }
  }, [group?.settle_currency]);

  useEffect(() => {
    if (members.length > 0 && !payerId) {
      setPayerId(members[0]!.id);
      setSelectedMemberIds(new Set(members.map((m) => m.id)));
    }
  }, [members]);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      if (!group?.settle_currency || currency === group.settle_currency) {
        setExchangeRate("1");
        return;
      }
      try {
        const { rate } = await fetchRate({ data: { from: currency, to: group.settle_currency } });
        if (!cancelled) setExchangeRate(rate.toFixed(6));
      } catch {
        if (!cancelled) setExchangeRate("1");
      }
    }
    fetch();
    return () => {
      cancelled = true;
    };
  }, [currency, group?.settle_currency]);

  const numericAmount = Number(amount) || 0;
  const numericRate = Number(exchangeRate) || 1;
  const settleAmount = numericAmount / numericRate;

  const splits = useMemo(() => {
    const selected = members.filter((m) => selectedMemberIds.has(m.id));
    if (selected.length === 0) return [];

    if (splitMode === "equal") {
      const each = settleAmount / selected.length;
      return selected.map((m) => ({ member_id: m.id, amount: Number(each.toFixed(4)) }));
    }

    const result: { member_id: string; amount: number }[] = [];
    let remaining = settleAmount;
    for (let i = 0; i < selected.length; i++) {
      const m = selected[i]!;
      const val = Number(customAmounts[m.id] ?? "0") || 0;
      if (i === selected.length - 1) {
        result.push({ member_id: m.id, amount: Number((remaining - result.reduce((s, r) => s + r.amount, 0)).toFixed(4)) });
      } else {
        result.push({ member_id: m.id, amount: val });
      }
    }
    return result;
  }, [members, selectedMemberIds, splitMode, customAmounts, settleAmount]);

  function toggleMember(id: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || numericAmount <= 0 || !payerId || splits.length === 0 || isSubmitting) {
      toast.error("Please fill in all fields and select at least one member.");
      return;
    }

    setIsSubmitting(true);
    try {
      await create({
        data: {
          group_id: groupId,
          amount: numericAmount,
          currency: currency.toUpperCase(),
          exchange_rate: numericRate,
          description: description.trim(),
          expense_date: date,
          payer_id: payerId,
          splits,
        },
      });
      toast.success("Expense added");
      navigate({ to: "/groups/$groupId", params: { groupId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add expense");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <header className="flex items-center gap-3 px-6 pt-8 pb-4">
        <button
          onClick={() => navigate({ to: "/groups/$groupId", params: { groupId } })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-3xl font-bold text-foreground">Add expense</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 px-6 pb-28">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Dinner in Rome"
              className="rounded-xl"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rate">Exchange rate to {group?.settle_currency ?? "EUR"}</Label>
            <Input
              id="rate"
              type="number"
              step="0.000001"
              min="0"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              1 {currency} = {exchangeRate} {group?.settle_currency ?? "EUR"} · settles to{" "}
              {settleAmount.toFixed(2)} {group?.settle_currency ?? "EUR"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payer">Paid by</Label>
            <select
              id="payer"
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Split between</Label>
              <div className="flex rounded-lg bg-secondary p-1">
                <button
                  type="button"
                  onClick={() => setSplitMode("equal")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${
                    splitMode === "equal" ? "bg-background text-foreground shadow" : "text-muted-foreground"
                  }`}
                >
                  Equal
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode("custom")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${
                    splitMode === "custom" ? "bg-background text-foreground shadow" : "text-muted-foreground"
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {members.map((m) => {
                const selected = selectedMemberIds.has(m.id);
                const split = splits.find((s) => s.member_id === m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-input bg-card text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                          selected ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {m.initial || m.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="font-medium text-foreground">{m.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {splitMode === "custom" && selected && (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={customAmounts[m.id] ?? ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            setCustomAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                          placeholder="0.00"
                          className="h-8 w-24 rounded-lg text-right"
                        />
                      )}
                      {selected ? (
                        <Check className="h-5 w-5 text-primary" />
                      ) : (
                        <Plus className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {splitMode === "equal" && (
              <p className="text-sm text-muted-foreground">
                Each selected member owes{" "}
                {splits.length > 0 ? (settleAmount / splits.length).toFixed(2) : "0.00"}{" "}
                {group?.settle_currency ?? "EUR"}
              </p>
            )}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/95 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-md">
            <Button
              type="submit"
              disabled={!description.trim() || numericAmount <= 0 || !payerId || splits.length === 0 || isSubmitting}
              className="w-full rounded-xl bg-primary py-6 text-base font-semibold text-primary-foreground"
            >
              Save expense
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

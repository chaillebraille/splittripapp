import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { round2, splitSettleAmount } from "@/lib/amounts";
import { getGroup } from "@/lib/data/groups";
import { listMembers, suggestMembers } from "@/lib/data/members";
import { createExpense, listExpenses } from "@/lib/data/expenses";
import { getExchangeRate } from "@/lib/data/rates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CurrencyPicker } from "@/components/CurrencyPicker";

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


function NewExpensePage() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchGroup = getGroup;
  const fetchMembers = listMembers;
  const fetchExpenses = listExpenses;
  const fetchRate = getExchangeRate;
  const create = createExpense;

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
  const [currencyTouched, setCurrencyTouched] = useState(false);

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", groupId],
    queryFn: () => fetchExpenses({ data: { group_id: groupId } }),
  });

  useEffect(() => {
    if (currencyTouched) return;
    // Default to the currency of the most recently entered expense;
    // fall back to the trip settle currency when there are no expenses yet.
    const latest = expenses[0]?.currency;
    if (latest) {
      setCurrency(latest);
    } else if (group?.settle_currency) {
      setCurrency(group.settle_currency);
    }
  }, [expenses, group?.settle_currency, currencyTouched]);

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
  const settleAmount = round2(numericAmount * numericRate);
  const settleCurrency = group?.settle_currency ?? "EUR";

  const selectedMembers = useMemo(
    () => members.filter((m) => selectedMemberIds.has(m.id)),
    [members, selectedMemberIds]
  );
  const equalShare = selectedMembers.length > 0 ? numericAmount / selectedMembers.length : 0;

  const splits = useMemo(() => {
    if (selectedMembers.length === 0) return [];

    if (splitMode === "equal") {
      const each = Number(equalShare.toFixed(2));
      return selectedMembers.map((m, i) =>
        i === selectedMembers.length - 1
          ? {
              member_id: m.id,
              amount: Number((numericAmount - each * (selectedMembers.length - 1)).toFixed(2)),
            }
          : { member_id: m.id, amount: each }
      );
    }

    return selectedMembers.map((m) => ({
      member_id: m.id,
      amount: Number((Number(customAmounts[m.id] ?? "0") || 0).toFixed(2)),
    }));
  }, [selectedMembers, splitMode, customAmounts, numericAmount, equalShare]);

  const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  const splitDifference = Number((numericAmount - splitTotal).toFixed(2));
  const splitsBalanced = Math.abs(splitDifference) < 0.005;

  // Splits are stored in the expense currency; members with a zero share are dropped.
  const savedSplits = splits.filter((s) => Math.abs(s.amount) >= 0.005);

  function useEqualSplit() {
    setSplitMode("equal");
  }

  function useCustomSplit() {
    const each = equalShare.toFixed(2);
    setCustomAmounts((prev) => {
      const next = { ...prev };
      for (const m of selectedMembers) next[m.id] = each;
      return next;
    });
    setSplitMode("custom");
  }

  function toggleMember(id: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        if (splitMode === "custom") {
          setCustomAmounts((amounts) => ({
            ...amounts,
            [id]: amounts[id] ?? equalShare.toFixed(2),
          }));
        }
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || numericAmount <= 0 || !payerId || savedSplits.length === 0 || isSubmitting) {
      toast.error("Please fill in all fields and select at least one member.");
      return;
    }
    if (!splitsBalanced) {
      toast.error("The split must add up to the full expense amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      await create({
        data: {
          group_id: groupId,
          currency: currency.toUpperCase(),
          exchange_rate: numericRate,
          description: description.trim(),
          expense_date: date,
          payer_id: payerId,
          splits: savedSplits,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["expenses", groupId] });
      await queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
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
              <CurrencyPicker id="currency" value={currency} onChange={(c) => { setCurrencyTouched(true); setCurrency(c); }} title="Expense currency" />
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
              1 {currency} = {exchangeRate} {settleCurrency} · settles to{" "}
              {settleAmount.toFixed(2)} {settleCurrency}
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
                  onClick={useEqualSplit}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${
                    splitMode === "equal" ? "bg-background text-foreground shadow" : "text-muted-foreground"
                  }`}
                >
                  Equal
                </button>
                <button
                  type="button"
                  onClick={useCustomSplit}
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
                  <div
                    key={m.id}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-input bg-card text-muted-foreground"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleMember(m.id)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                          selected ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {m.initial || m.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="font-medium text-foreground">{m.name}</span>
                    </button>
                    <div className="flex items-center gap-3">
                      {selected &&
                        (splitMode === "custom" ? (
                          <div className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              inputMode="decimal"
                              value={customAmounts[m.id] ?? equalShare.toFixed(2)}
                              onChange={(e) =>
                                setCustomAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))
                              }
                              placeholder="0.00"
                              className="h-8 w-24 rounded-lg text-right"
                            />
                            {currency !== settleCurrency && (
                              <span className="block text-xs text-muted-foreground">
                                ≈ {splitSettleAmount(split?.amount ?? 0, numericRate).toFixed(2)}{" "}
                                {settleCurrency}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-right text-sm font-semibold text-foreground">
                            {(split?.amount ?? 0).toFixed(2)} {currency}
                            {currency !== settleCurrency && (
                              <span className="block text-xs font-normal text-muted-foreground">
                                ≈ {splitSettleAmount(split?.amount ?? 0, numericRate).toFixed(2)}{" "}
                                {settleCurrency}
                              </span>
                            )}
                          </span>
                        ))}
                      <button
                        type="button"
                        onClick={() => toggleMember(m.id)}
                        aria-label={selected ? `Remove ${m.name}` : `Add ${m.name}`}
                      >
                        {selected ? (
                          <Check className="h-5 w-5 text-primary" />
                        ) : (
                          <Plus className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                );

              })}
            </div>

            <div className="rounded-xl bg-card p-3 text-sm shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Split total</span>
                <span className="font-semibold text-card-foreground">
                  {splitTotal.toFixed(2)} {currency}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Expense total</span>
                <span className="font-semibold text-card-foreground">
                  {numericAmount.toFixed(2)} {currency}
                </span>
              </div>
              {!splitsBalanced && (
                <p className="mt-2 font-semibold text-destructive">
                  {splitDifference > 0
                    ? `${splitDifference.toFixed(2)} ${currency} left to assign`
                    : `${Math.abs(splitDifference).toFixed(2)} ${currency} over the expense`}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/95 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-md">
            <Button
              type="submit"
              disabled={!description.trim() || numericAmount <= 0 || !payerId || splits.length === 0 || !splitsBalanced || isSubmitting}
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

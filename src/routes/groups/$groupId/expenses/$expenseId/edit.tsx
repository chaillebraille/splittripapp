import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { getGroup } from "@/lib/data/groups";
import { listMembers } from "@/lib/data/members";
import { getExpense, updateExpense } from "@/lib/data/expenses";
import { getExchangeRate } from "@/lib/data/rates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CurrencyPicker } from "@/components/CurrencyPicker";

export const Route = createFileRoute("/groups/$groupId/expenses/$expenseId/edit")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Edit expense — SplitTrip" },
      { name: "description", content: "Edit an existing expense." },
      { property: "og:title", content: "Edit expense — SplitTrip" },
      { property: "og:description", content: "Edit an existing expense." },
    ],
  }),
  component: EditExpensePage,
});


function EditExpensePage() {
  const { groupId, expenseId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchGroup = getGroup;
  const fetchMembers = listMembers;
  const fetchExpense = getExpense;
  const fetchRate = getExchangeRate;
  const update = updateExpense;

  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroup({ data: { id: groupId } }),
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members", groupId],
    queryFn: () => fetchMembers({ data: { group_id: groupId } }),
  });
  const { data: expense, isLoading } = useQuery({
    queryKey: ["expense", expenseId],
    queryFn: () => fetchExpense({ data: { id: expenseId } }),
  });

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [payerId, setPayerId] = useState<string>("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!expense) return;
    setDescription(expense.description ?? "");
    setAmount(String(expense.amount));
    setCurrency(expense.currency);
    setExchangeRate(String(expense.exchange_rate));
    setDate(expense.expense_date);
    setPayerId(expense.payer_id ?? "");
    const splitMemberIds = new Set((expense.expense_splits ?? []).map((s) => s.member_id));
    setSelectedMemberIds(splitMemberIds);

    const splits = expense.expense_splits ?? [];
    const rate = Number(expense.exchange_rate) || 1;
    // Stored splits are in the settle currency; the form works in the expense currency.
    const equalShare = Number(expense.amount) / (splits.length || 1);
    const isEqual = splits.every((s) => Math.abs(Number(s.amount) / rate - equalShare) < 0.01);
    setSplitMode(isEqual ? "equal" : "custom");

    const amounts: Record<string, string> = {};
    for (const s of splits) {
      amounts[s.member_id] = (Number(s.amount) / rate).toFixed(2);
    }
    setCustomAmounts(amounts);
  }, [expense]);

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

  const canEdit = (group?.my_role ?? "owner") !== "viewer";
  const numericAmount = Number(amount) || 0;
  const numericRate = Number(exchangeRate) || 1;
  const settleAmount = numericAmount * numericRate;
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

  // Splits are entered in the expense currency; store them in the trip settle currency.
  const settleSplits = splits.map((s, i) =>
    i === splits.length - 1
      ? {
          member_id: s.member_id,
          amount: Number(
            (
              settleAmount -
              splits
                .slice(0, -1)
                .reduce((sum, other) => sum + Number((other.amount * numericRate).toFixed(2)), 0)
            ).toFixed(2)
          ),
        }
      : { member_id: s.member_id, amount: Number((s.amount * numericRate).toFixed(2)) }
  );

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
    if (!description.trim() || numericAmount <= 0 || !payerId || splits.length === 0 || isSubmitting) {
      toast.error("Please fill in all fields and select at least one member.");
      return;
    }
    if (!splitsBalanced) {
      toast.error("The split must add up to the full expense amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      await update({
        data: {
          id: expenseId,
          group_id: groupId,
          amount: numericAmount,
          currency: currency.toUpperCase(),
          exchange_rate: numericRate,
          description: description.trim(),
          expense_date: date,
          payer_id: payerId,
          splits: settleSplits,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["expenses", groupId] });
      queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
      toast.success("Expense updated");
      navigate({ to: "/groups/$groupId", params: { groupId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update expense");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading expense…
      </div>
    );
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
        <h1 className="font-display text-3xl font-bold text-foreground">{canEdit ? "Edit expense" : "Expense"}</h1>
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
              disabled={!canEdit}
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
                disabled={!canEdit}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <CurrencyPicker id="currency" value={currency} onChange={setCurrency} disabled={!canEdit} title="Expense currency" />
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
              disabled={!canEdit}
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
              disabled={!canEdit}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payer">Paid by</Label>
            <select
              id="payer"
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              disabled={!canEdit}
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
                  disabled={!canEdit}
                  onClick={useEqualSplit}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${
                    splitMode === "equal" ? "bg-background text-foreground shadow" : "text-muted-foreground"
                  }`}
                >
                  Equal
                </button>
                <button
                  type="button"
                  disabled={!canEdit}
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
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!canEdit}
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
                      {selected &&
                        (splitMode === "custom" ? (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={customAmounts[m.id] ?? equalShare.toFixed(2)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setCustomAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))
                            }
                            placeholder="0.00"
                            disabled={!canEdit}
                            className="h-8 w-24 rounded-lg text-right"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-foreground">
                            {(splits.find((s) => s.member_id === m.id)?.amount ?? 0).toFixed(2)}{" "}
                            {currency}
                          </span>
                        ))}
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

        {canEdit && (
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/95 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-md">
            <Button
              type="submit"
              disabled={!description.trim() || numericAmount <= 0 || !payerId || splits.length === 0 || !splitsBalanced || isSubmitting}
              className="w-full rounded-xl bg-primary py-6 text-base font-semibold text-primary-foreground"
            >
              Update expense
            </Button>
          </div>
        </div>
        )}
      </form>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { Receipt, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { expenseSettleTotal, expenseTotal } from "@/lib/amounts";

export type ExpenseListItem = {
  id: string;
  description: string | null;
  currency: string;
  exchange_rate: number;
  expense_splits: { member_id: string; amount: number }[];
  expense_date: string;
  payer_id: string | null;
};

type Props = {
  expenses: ExpenseListItem[];
  members: { id: string; name: string }[];
  groupId: string;
  settleCurrency: string | undefined;
  deletingExpenseId: string | null;
  onDelete: (id: string) => void;
  /** When false, rows are read-only: no edit navigation and no delete button. */
  canEdit?: boolean;
  emptyLabel?: string;
  /** When provided, the secondary line shows "Your share: <amount>" instead of the converted total. */
  shareAmounts?: Record<string, number>;
};

function ExpenseRow({
  expense,
  payer,
  settleCurrency,
  shareAmounts,
}: {
  expense: ExpenseListItem;
  payer: { id: string; name: string } | undefined;
  settleCurrency: string | undefined;
  shareAmounts: Record<string, number> | undefined;
}) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-card-foreground">{expense.description}</p>
        <p className="text-xs text-muted-foreground">
          Paid by {payer?.name ?? "Unknown"} · {format(new Date(expense.expense_date), "MMM d")}
        </p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-card-foreground">
          {expenseTotal(expense.expense_splits).toFixed(2)} {expense.currency}
        </p>
        <p className="text-xs text-muted-foreground">
          {shareAmounts
            ? `Your share: ${Number(shareAmounts[expense.id] ?? 0).toFixed(2)} ${settleCurrency ?? ""}`
            : `≈ ${expenseSettleTotal(expense.expense_splits, expense.exchange_rate).toFixed(2)} ${settleCurrency ?? ""}`}
        </p>
      </div>
    </>
  );
}

export function ExpenseList({
  expenses,
  members,
  groupId,
  settleCurrency,
  deletingExpenseId,
  onDelete,
  canEdit = true,
  emptyLabel = "No expenses yet.",
  shareAmounts,
}: Props) {
  const [pendingDelete, setPendingDelete] = useState<ExpenseListItem | null>(null);

  if (expenses.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-6 text-center text-muted-foreground shadow-sm">
        <Receipt className="mx-auto mb-2 h-8 w-8" />
        {emptyLabel}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {expenses.map((expense) => {
          const payer = members.find((m) => m.id === expense.payer_id);
          return (
            <div
              key={expense.id}
              className="flex items-center gap-2 rounded-2xl bg-card p-4 shadow-sm"
            >
              <Link
                to="/groups/$groupId/expenses/$expenseId/edit"
                params={{ groupId, expenseId: expense.id }}
                className="flex min-w-0 flex-1 items-center justify-between gap-3"
              >
                <ExpenseRow expense={expense} payer={payer} settleCurrency={settleCurrency} shareAmounts={shareAmounts} />
              </Link>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setPendingDelete(expense)}
                  disabled={deletingExpenseId === expense.id}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete expense"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.description
                ? `"${pendingDelete.description}" will be permanently removed.`
                : "This expense will be permanently removed."}{" "}
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

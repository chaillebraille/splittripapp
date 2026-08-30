import { Link } from "@tanstack/react-router";
import { MoreHorizontal, Receipt, Trash2 } from "lucide-react";
import { format } from "date-fns";

export type ExpenseListItem = {
  id: string;
  description: string | null;
  amount: number;
  currency: string;
  settle_amount: number | null;
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
  emptyLabel?: string;
};

export function ExpenseList({
  expenses,
  members,
  groupId,
  settleCurrency,
  deletingExpenseId,
  onDelete,
  emptyLabel = "No expenses yet.",
}: Props) {
  if (expenses.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-6 text-center text-muted-foreground shadow-sm">
        <Receipt className="mx-auto mb-2 h-8 w-8" />
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {expenses.map((expense) => {
        const payer = members.find((m) => m.id === expense.payer_id);
        return (
          <div
            key={expense.id}
            className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-card-foreground">{expense.description}</p>
              <p className="text-xs text-muted-foreground">
                Paid by {payer?.name ?? "Unknown"} ·{" "}
                {format(new Date(expense.expense_date), "MMM d")}
              </p>
            </div>
            <div className="flex items-center gap-3 text-right">
              <div>
                <p className="font-semibold text-card-foreground">
                  {expense.amount} {expense.currency}
                </p>
                <p className="text-xs text-muted-foreground">
                  ≈ {Number(expense.settle_amount ?? 0).toFixed(2)} {settleCurrency}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  to="/groups/$groupId/expenses/$expenseId/edit"
                  params={{ groupId, expenseId: expense.id }}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
                  aria-label="Edit expense"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(expense.id)}
                  disabled={deletingExpenseId === expense.id}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete expense"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

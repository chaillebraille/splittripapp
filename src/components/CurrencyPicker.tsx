import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CURRENCIES, currencyName } from "@/lib/currencies";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
};

/** Currency selector: a button that opens a scrollable list of all supported currencies. */
export function CurrencyPicker({ id, value, onChange, disabled, className, title }: Props) {
  const [open, setOpen] = useState(false);
  const name = currencyName(value);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 text-left text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-60",
            className,
          )}
        >
          <span className="truncate">
            <span className="font-medium">{value}</span>
            {name ? <span className="text-muted-foreground"> — {name}</span> : null}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>{title ?? "Select currency"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto overflow-x-auto px-2 pb-4">
          <ul className="min-w-max">
            {CURRENCIES.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(c.code);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                    c.code === value && "bg-accent",
                  )}
                >
                  <span className="w-12 shrink-0 font-semibold">{c.code}</span>
                  <span className="text-muted-foreground">{c.name}</span>
                  {c.code === value && <Check className="ml-auto h-4 w-4 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
